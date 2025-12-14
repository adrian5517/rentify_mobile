import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  Image,
  Keyboard,
  KeyboardAvoidingView,
} from 'react-native';
import { GiftedChat, Bubble, InputToolbar, Send, Actions, Composer } from 'react-native-gifted-chat';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import ApiService from '../services/apiService';
import WebSocketService from '../services/websocketService';
import messageCache from '../services/messageCache';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../store/authStore';
import normalizeAvatar from '../utils/normalizeAvatar';
import COLORS from '../constant/colors';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppState } from 'react-native';
import { API_URL as BASE_API_URL } from '../constant/api';

export default function ChatScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // Use same destructuring as profile tab for consistency
  const { user } = useAuthStore();
  const params = useLocalSearchParams();

  // use normalizeAvatar helper imported from app/utils/normalizeAvatar
  
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasEarlier, setHasEarlier] = useState(false);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [ttlMinutes, setTtlMinutes] = useState(5);
  const [conversationId, setConversationId] = useState(params.conversationId || null);
  
  // User and property details from navigation params
  
  // User and property details from navigation params
  const otherUserId = params.otherUserId;
  const otherUserName = params.otherUserName || 'User';
  // Normalize avatar param (accept string or object shapes)
  let otherUserAvatar = normalizeAvatar(params.otherUserAvatar || params.otherUser?.profilePicture || params.otherUser);
  const propertyId = params.propertyId;
  const propertyName = params.propertyName;

  // Resolve current user's profile picture similarly to profile tab
  const DEFAULT_AVATAR = 'https://api.dicebear.com/7.x/avataaars/png?seed=default';
  const resolveProfilePicture = (u) => {
    if (!u) return DEFAULT_AVATAR;
    const cand = u.profilePicture || u.profile_picture || u.avatar || u.picture || null;
    if (!cand) return DEFAULT_AVATAR;
    if (typeof cand === 'string') {
      let avatar = cand;
      if (avatar.includes('api.dicebear.com') && avatar.includes('/svg?')) avatar = avatar.replace('/svg?', '/png?');
      if (!avatar.startsWith('http')) avatar = `${BASE_API_URL}${avatar.startsWith('/') ? avatar : `/${avatar}`}`;
      return avatar;
    }
    if (typeof cand === 'object') {
      const objUrl = cand.url || cand.path || cand.secure_url || cand.location || cand.uri || (Array.isArray(cand) && cand[0]) || null;
      if (!objUrl) return DEFAULT_AVATAR;
      let avatar = objUrl;
      if (avatar.includes('api.dicebear.com') && avatar.includes('/svg?')) avatar = avatar.replace('/svg?', '/png?');
      if (!avatar.startsWith('http')) avatar = `${BASE_API_URL}${avatar.startsWith('/') ? avatar : `/${avatar}`}`;
      return avatar;
    }
    return DEFAULT_AVATAR;
  };

  // Caching helpers (SQLite via messageCache service)
  const loadCachedMessages = async (convId) => {
    try {
      const convKey = convId || conversationId || otherUserId;
      const rows = await messageCache.getMessages(convKey, 500);
      return rows;
    } catch (err) {
      console.warn('Failed to load cached messages (sqlite)', err);
      return [];
    }
  };

  const saveMessagesToCache = async (convId, msgs) => {
    try {
      const convKey = convId || conversationId || otherUserId;
      await messageCache.saveMessages(convKey, msgs);
    } catch (err) {
      console.warn('Failed to save cached messages (sqlite)', err);
    }
  };

  const mergeMessagesDedup = (existing = [], incoming = []) => {
    const map = new Map();
    // keep newer message (by createdAt)
    [...existing, ...incoming].forEach(m => {
      if (!m || !m._id) return;
      const prev = map.get(m._id);
      if (!prev) map.set(m._id, m);
      else {
        const prevTime = new Date(prev.createdAt).getTime();
        const curTime = new Date(m.createdAt).getTime();
        if (curTime > prevTime) map.set(m._id, m);
      }
    });
    // return sorted newest-first
    return Array.from(map.values()).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  };

  // Load messages
  const PAGE_SIZE = 50;

  const loadMessages = useCallback(async (opts = {}) => {
    if (!otherUserId) {
      // no other user specified
      setLoading(false);
      return;
    }
    // Show cached messages immediately (if any)
    try {
      const convKey = conversationId || otherUserId;
      const cached = await loadCachedMessages(convKey);
      if (cached && cached.length > 0) {
        // Normalize avatars in cached messages so they match profile resolver
        const normalizedCached = cached.map(m => {
          try {
            const uid = m?.user?._id;
            if (uid && user && uid === user._id) {
              // ensure our own messages use the profile resolver
              return { ...m, user: { ...m.user, avatar: resolveProfilePicture(user) } };
            }
            // for other users, re-normalize via helper to pick up base URL changes
            const avatarInput = m?.user?.avatar || m?.user?.profilePicture || m?.user;
            return { ...m, user: { ...m.user, avatar: normalizeAvatar(avatarInput) } };
          } catch (err) {
            return m;
          }
        });

        setMessages(normalizedCached);
        console.log('📦 Loaded messages from cache:', normalizedCached.length);
      }

      // Determine TTL (user-configurable via AsyncStorage) and check staleness
      const TTL_MINUTES = opts.ttlMinutes ?? ttlMinutes ?? 5;
      const stale = await messageCache.isCacheStale(convKey, TTL_MINUTES);
      if (!stale) {
        console.log(`📩 Skipping network fetch for ${convKey} — cache fresh (<${TTL_MINUTES}min)`);
        setLoading(false);
        return;
      }
      console.log('📩 Loading messages with user:', otherUserId);
      setIsRefreshing(true);
      // Request recent messages with optional pagination
      const limit = opts.limit || PAGE_SIZE;
      const before = opts.before || undefined;
      const response = await ApiService.getMessagesBetweenUsers(otherUserId, { limit, before });

      if (response.success) {
        const backendMessages = response.messages || response.data || [];

        // Format messages for GiftedChat
        const formattedMessages = backendMessages.map(msg => ({
          _id: msg._id,
          text: msg.message || msg.text || '',
          createdAt: new Date(msg.createdAt),
          user: {
            _id: msg.sender?._id || msg.sender,
            name: msg.sender?.name || 'User',
            avatar: normalizeAvatar(msg.sender?.profilePicture || ''),
          },
          sent: true,
          received: msg.read,
          image: msg.imageUrls && msg.imageUrls.length > 0 ? msg.imageUrls[0] : undefined,
        }));

        // GiftedChat expects newest-first. Backend may already be sorted asc/desc.
        // We'll ensure newest-first by sorting by createdAt descending.
        formattedMessages.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        // Merge with cached messages, deduplicate, and persist
        const merged = mergeMessagesDedup(cached, formattedMessages);
        setMessages(merged);
        await saveMessagesToCache(conversationId || otherUserId, merged);
        setHasEarlier(backendMessages.length === limit); // If we got a full page, older messages may exist
        console.log('✅ Messages loaded:', formattedMessages.length);
      } else {
        console.error('❌ Failed to load messages:', response.error);
        if (response.error !== 'Resource not found') {
          Alert.alert('Error', 'Failed to load messages');
        }
      }
    } catch (error) {
      console.error('❌ Error loading messages:', error);
      Alert.alert('Error', 'Failed to load messages');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [otherUserId]);

  // Fetch older messages (load earlier)
  const loadEarlierMessages = useCallback(async () => {
    if (!messages || messages.length === 0) return;
    if (!hasEarlier) return;

    setLoadingEarlier(true);
    try {
      const oldest = messages[messages.length - 1];
      const before = oldest?.createdAt ? new Date(oldest.createdAt).toISOString() : undefined;
      const response = await ApiService.getMessagesBetweenUsers(otherUserId, { limit: PAGE_SIZE, before });

      if (response.success) {
        const backendMessages = response.messages || response.data || [];
        if (backendMessages.length === 0) {
          setHasEarlier(false);
          return;
        }

        const formatted = backendMessages.map(msg => ({
          _id: msg._id,
          text: msg.message || msg.text || '',
          createdAt: new Date(msg.createdAt),
          user: {
            _id: msg.sender?._id || msg.sender,
            name: msg.sender?.name || 'User',
            avatar: normalizeAvatar(msg.sender?.profilePicture || ''),
          },
          sent: true,
          received: msg.read,
          image: msg.imageUrls && msg.imageUrls.length > 0 ? msg.imageUrls[0] : undefined,
        }));

        formatted.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        // Prepend older messages to existing list, then persist
        setMessages(prev => {
          const merged = mergeMessagesDedup(prev || [], formatted);
          saveMessagesToCache(conversationId || otherUserId, merged);
          return GiftedChat.append(prev, formatted);
        });

        // If fewer than page size returned, no more older messages
        if (backendMessages.length < PAGE_SIZE) setHasEarlier(false);
      }
    } catch (err) {
      console.error('Error loading earlier messages:', err);
    } finally {
      setLoadingEarlier(false);
    }
  }, [messages, otherUserId, hasEarlier]);

  // Initialize WebSocket and load messages
  useEffect(() => {
    if (!user) {
      Alert.alert('Error', 'Please login to continue');
      router.back();
      return;
    }

    // Connect WebSocket if not already connected
    if (!WebSocketService.isConnected()) {
      WebSocketService.connect();
    }

    loadMessages();

    // Listen for new messages from your backend's "private-message" event
    const handleNewMessage = (message) => {
      console.log('📨 Received new message:', message);
      
      // Check if message is for this chat (from or to the other user)
      const isSentByOther = (message.sender?._id || message.sender) === otherUserId;
      const isSentToOther = (message.receiver?._id || message.receiver) === otherUserId;
      const isSentByMe = (message.sender?._id || message.sender) === user._id;
      
      if ((isSentByOther && !isSentByMe) || (isSentToOther && isSentByMe)) {
        const formattedMessage = {
          _id: message._id,
          text: message.message || message.text || '', // Your backend uses 'message'
          createdAt: new Date(message.createdAt || new Date()),
          user: {
            _id: message.sender?._id || message.sender,
            name: message.sender?.name || 'User',
            avatar: normalizeAvatar(message.sender?.profilePicture || ''),
          },
          sent: true,
          received: message.read,
          image: message.imageUrls && message.imageUrls.length > 0 ? message.imageUrls[0] : undefined,
        };

        setMessages(previousMessages => {
          const updated = GiftedChat.append(previousMessages, [formattedMessage]);
          // persist
          saveMessagesToCache(conversationId || otherUserId, updated);
          return updated;
        });

        // Mark as read if message is from other user
        if (isSentByOther) {
          ApiService.markAsRead(message._id);
        }
      }
    };

    // Listen for websocket connection events (reconnect/connected) to refresh stale cache
    const handleConnectionEvent = (data) => {
      try {
        const status = data?.status;
        if (status === 'connected' || status === 'reconnected') {
          // If cache is stale for this conversation, refresh from server
          (async () => {
            try {
              const convKey = conversationId || otherUserId;
              if (!convKey) return;
              const stale = await messageCache.isCacheStale(convKey, 5);
              if (stale) {
                console.log('🔁 Connection restored — refreshing stale conversation:', convKey);
                await loadMessages({});
              } else {
                console.log('🟢 Connection restored — cache fresh, skipping refresh for', convKey);
              }
            } catch (err) {
              console.warn('Error refreshing messages after reconnect', err);
            }
          })();
        }
      } catch (err) {
        console.warn('handleConnectionEvent error', err);
      }
    };

    // Listen for typing indicator (backend may emit different shapes)
    const handleTyping = (data) => {
      // data might be { userId, isTyping } or { senderId, isTyping } or { conversationId, isTyping }
      const typing = data?.isTyping;
      const senderId = data?.userId || data?.senderId || data?.sender;
      const convId = data?.conversationId || data?.conversation;

      if (senderId && senderId === otherUserId) {
        setIsTyping(!!typing);
      } else if (convId && conversationId && convId === conversationId) {
        setIsTyping(!!typing);
      } else if (senderId && conversationId == null && senderId === otherUserId) {
        // fallback when conversationId not available
        setIsTyping(!!typing);
      }
    };

    // Listen for both 'message' and 'private-message' events
    WebSocketService.addEventListener('message', handleNewMessage);
    WebSocketService.addEventListener('private-message', handleNewMessage);
    WebSocketService.addEventListener('typing', handleTyping);
    WebSocketService.addEventListener('connection', handleConnectionEvent);

    // Cleanup
    return () => {
      WebSocketService.removeEventListener('message', handleNewMessage);
      WebSocketService.removeEventListener('private-message', handleNewMessage);
      WebSocketService.removeEventListener('typing', handleTyping);
      WebSocketService.removeEventListener('connection', handleConnectionEvent);
    };
  }, [user, otherUserId, router, loadMessages]);

  // Background refresh on app resume
  useEffect(() => {
    let prevState = AppState.currentState;

    const handleAppStateChange = async (nextState) => {
      try {
        if (prevState.match(/inactive|background/) && nextState === 'active') {
          const convKey = conversationId || otherUserId;
          if (!convKey) return;
          const stale = await messageCache.isCacheStale(convKey, 5);
          if (stale) {
            console.log('🔄 App resumed — refreshing stale conversation:', convKey);
            await loadMessages({});
          } else {
            console.log('🟢 App resumed — cache fresh, skipping refresh for', convKey);
          }
        }
      } catch (err) {
        console.warn('AppState refresh error', err);
      } finally {
        prevState = nextState;
      }
    };

    const sub = AppState.addEventListener ? AppState.addEventListener('change', handleAppStateChange) : AppState.addEventListener('change', handleAppStateChange);

    return () => {
      try {
        if (sub && typeof sub.remove === 'function') sub.remove();
        else AppState.removeEventListener('change', handleAppStateChange);
      } catch (err) {
        /* ignore */
      }
    };
  }, [conversationId, otherUserId, loadMessages]);

  // Send message
  const onSend = useCallback(async (newMessages = []) => {
    const message = newMessages[0];
    
    try {
      console.log('📤 Sending message:', message.text);
      
      // Send via API (which calls POST /messages/send)
      const response = await ApiService.sendMessage({
        recipientId: otherUserId,
        text: message.text,
        content: message.text, // Support both formats
      });

      if (response.success) {
        console.log('✅ Message sent successfully via API');
        
        // Also send via WebSocket for real-time delivery to recipient
        WebSocketService.sendMessage({
          senderId: user._id,
          receiverId: otherUserId,
          text: message.text,
          images: [],
        });

        // Add message to local state immediately
        const formattedMessage = {
          _id: response.data._id || response.message?._id || Date.now().toString(),
          text: message.text,
          createdAt: new Date(),
          user: {
            _id: user._id,
            name: user.name,
            avatar: resolveProfilePicture(user),
          },
          sent: true,
          received: false,
        };

        setMessages(previousMessages =>
          GiftedChat.append(previousMessages, [formattedMessage])
        );

        // persist image message
        try {
          const updatedCache = mergeMessagesDedup(messages || [], [formattedMessage]);
          saveMessagesToCache(conversationId || otherUserId, updatedCache);
        } catch (err) {
          console.warn('Failed to persist image message', err);
        }

        // persist sent message
        try {
          const updatedCache = mergeMessagesDedup(messages || [], [formattedMessage]);
          saveMessagesToCache(conversationId || otherUserId, updatedCache);
        } catch (err) {
          console.warn('Failed to persist sent message', err);
        }
      } else {
        console.error('❌ Failed to send message:', response.error);
        Alert.alert('Error', 'Failed to send message');
      }
    } catch (error) {
      console.error('❌ Error sending message:', error);
      Alert.alert('Error', 'Failed to send message');
    }
  }, [user, otherUserId]);

  // Memoize render callbacks to reduce re-renders
  const memoizedRenderBubble = useCallback((props) => renderBubble(props), []);
  const memoizedRenderComposer = useCallback((props) => renderComposer(props), []);
  const memoizedRenderInputToolbar = useCallback((props) => renderInputToolbar(props), []);
  const memoizedRenderSend = useCallback((props) => renderSend(props), []);
  const memoizedRenderActions = useCallback((props) => renderActions(props), []);

  // Pick image from library
  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow access to your photo library');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaType.Images,
        allowsMultipleSelection: false,
        quality: 0.7,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const imageUri = result.assets[0].uri;
        
        // Send image message
        sendImageMessage(imageUri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  // Take photo with camera
  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow access to your camera');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaType.Images,
        quality: 0.7,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const imageUri = result.assets[0].uri;
        
        // Send image message
        sendImageMessage(imageUri);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  // Send image message
  const sendImageMessage = async (imageUri) => {
    try {
      // Create form data
      const formData = new FormData();
      formData.append('senderId', user._id);
      formData.append('receiverId', otherUserId);
      formData.append('text', ''); // Empty text for image-only message
      
      // Add image file
      const filename = imageUri.split('/').pop();
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';
      
      formData.append('files', {
        uri: imageUri,
        name: filename,
        type: type,
      });

      // Send via API
      const response = await fetch(`${BASE_API_URL}/api/messages/send`, {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      // Try to parse JSON response; if server returned HTML (error page), handle gracefully
      let data = null;
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        console.warn('sendImageMessage: non-JSON response:', text.substring(0, 300));
        // Provide the raw text in the alert so user/developer can see server output
        Alert.alert('Error', `Failed to send image: ${text.substring(0, 200)}`);
      }

      if (response.ok && data) {
        // Add to messages
        const formattedMessage = {
          _id: data._id || Date.now().toString(),
          text: '',
          image: data.imageUrls && data.imageUrls[0],
          createdAt: new Date(),
          user: {
            _id: user._id,
            name: user.name || user.username,
            avatar: resolveProfilePicture(user),
          },
          sent: true,
          received: false,
        };

        setMessages(previousMessages => {
          const updated = GiftedChat.append(previousMessages, [formattedMessage]);
          // persist image message
          try {
            saveMessagesToCache(conversationId || otherUserId, mergeMessagesDedup(updated || [], []));
          } catch (err) {
            console.warn('Failed to persist image message', err);
          }
          return updated;
        });

        // Send via WebSocket
        WebSocketService.sendMessage({
          senderId: user._id,
          receiverId: otherUserId,
          text: '',
          images: data.imageUrls || [],
        });
      } else if (!response.ok) {
        // If server responded non-OK but with JSON, show message
        const message = data?.message || data?.error || 'Failed to send image';
        Alert.alert('Error', message);
      }
    } catch (error) {
      console.error('Error sending image:', error);
      Alert.alert('Error', 'Failed to send image');
    }
  };

  // Handle attachment button press
  const handleAttachment = () => {
    Alert.alert(
      'Send Photo',
      'Choose an option',
      [
        {
          text: 'Take Photo',
          onPress: takePhoto,
        },
        {
          text: 'Choose from Library',
          onPress: pickImage,
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

  // Handle typing indicator
  const handleInputTextChanged = useCallback((text) => {
    const isTyping = text.length > 0;
    try {
      // Emit structured typing payload; backend listeners are tolerant to different shapes
      WebSocketService.emitTyping({ conversationId, senderId: user?._id, receiverId: otherUserId, isTyping });
      // Also emit legacy shape for servers listening for (conversationId, boolean)
      WebSocketService.emitTyping(conversationId, isTyping);
    } catch (err) {
      console.warn('emitTyping failed', err);
    }
  }, [conversationId, otherUserId, user]);

  // Render message bubble
  const renderBubble = (props) => {
    return (
      <Bubble
        {...props}
        wrapperStyle={{
          right: {
            backgroundColor: COLORS.primary,
            borderRadius: 20,
            borderBottomRightRadius: 4,
            padding: 4,
            marginVertical: 4,
          },
          left: {
            backgroundColor: '#fff',
            borderRadius: 20,
            borderBottomLeftRadius: 4,
            padding: 4,
            marginVertical: 4,
          },
        }}
        textStyle={{
          right: {
            color: '#fff',
            fontSize: 15,
            lineHeight: 20,
          },
          left: {
            color: '#000',
            fontSize: 15,
            lineHeight: 20,
          },
        }}
        timeTextStyle={{
          right: {
            color: 'rgba(255,255,255,0.7)',
            fontSize: 11,
          },
          left: {
            color: '#999',
            fontSize: 11,
          },
        }}
      />
    );
  };

  // Render composer with explicit styling for visibility
  const renderComposer = (props) => {
    return (
      <Composer
        {...props}
        textInputStyle={{
          color: '#000000',
          backgroundColor: '#ffffff',
          paddingTop: 8,
          paddingBottom: 8,
          paddingHorizontal: 12,
          fontSize: 16,
          lineHeight: 22,
          minHeight: 44,
        }}
        textInputProps={{
          ...props.textInputProps,
          style: {
            color: '#000000',
            fontSize: 16,
            paddingTop: 8,
            paddingBottom: 8,
          }
        }}
        placeholder="Type a message..."
        placeholderTextColor="#999999"
        multiline={true}
      />
    );
  };

  // Render input toolbar
  const renderInputToolbar = (props) => {
    return (
      <InputToolbar
        {...props}
        containerStyle={styles.inputToolbar}
        primaryStyle={styles.inputToolbarPrimary}
      />
    );
  };

  // Render send button
  const renderSend = (props) => {
    return (
      <Send {...props}>
        <View style={styles.sendButton}>
          <Ionicons name="send" size={24} color={COLORS.primary} />
        </View>
      </Send>
    );
  };

  // Render actions button (attachment)
  const renderActions = (props) => {
    return (
      <Actions
        {...props}
        containerStyle={styles.actionsContainer}
        icon={() => (
          <Ionicons name="attach" size={26} color={COLORS.primary} />
        )}
        options={{
          'Take Photo': takePhoto,
          'Choose from Library': pickImage,
          'Cancel': () => {},
        }}
        optionTintColor={COLORS.primary}
        onPressActionButton={handleAttachment}
      />
    );
  };

  if (!user) {
    return (
      <View style={styles.container}>
        <Text>Please login to continue</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading messages...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f5f5f5' }} edges={['top', 'bottom']}>
      <Stack.Screen
        options={{
          title: '',
          headerShown: true,
          headerBackTitle: 'Back',
          headerLeft: () => (
            <TouchableOpacity
              style={styles.headerLeftContainer}
              onPress={() => router.back()}
            >
              <Ionicons name="chevron-back" size={24} color={COLORS.primary} />
              <Image
                source={{ 
                  uri: (otherUserAvatar && otherUserAvatar.startsWith('http'))
                    ? otherUserAvatar
                    : (otherUserAvatar ? `${BASE_API_URL}${otherUserAvatar}` : 'https://api.dicebear.com/7.x/avataaars/png?seed=default')
                }}
                style={styles.headerAvatar}
              />
              <View style={styles.headerTextContainer}>
                <Text style={styles.headerName}>{otherUserName}</Text>
                {propertyName && (
                  <View style={styles.headerPropertyBadge}>
                    <Ionicons name="home" size={10} color={COLORS.primary} />
                    <Text style={styles.headerPropertyText} numberOfLines={1}>
                      {propertyName}
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          ),
          headerRight: () => (
            <View style={styles.headerRightContainer}>
              <TouchableOpacity style={styles.headerIcon}>
                <Ionicons name="videocam-outline" size={24} color={COLORS.primary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.headerIcon}>
                <Ionicons name="call-outline" size={24} color={COLORS.primary} />
              </TouchableOpacity>
            </View>
          ),
        }}
      />

      {isRefreshing && (
        <View style={styles.refreshBanner}>
          <ActivityIndicator size="small" color={COLORS.primary} />
          <Text style={styles.refreshText}>Refreshing messages…</Text>
        </View>
      )}

      <GiftedChat
        messages={messages}
        onSend={messages => onSend(messages)}
        onInputTextChanged={handleInputTextChanged}
        user={{
          _id: user._id,
          name: user.name || user.username,
          avatar: resolveProfilePicture(user),
        }}
        renderBubble={memoizedRenderBubble}
        renderInputToolbar={memoizedRenderInputToolbar}
        renderSend={memoizedRenderSend}
        renderActions={memoizedRenderActions}
        alwaysShowSend
        scrollToBottom
        isTyping={isTyping}
        placeholder="Type a message..."
        showAvatarForEveryMessage={false}
        showUserAvatar={true}
        dateFormat="MMM D, YYYY"
        timeFormat="h:mm A"
        messagesContainerStyle={styles.messagesContainer}
        loadEarlier={hasEarlier}
        onLoadEarlier={loadEarlierMessages}
        isLoadingEarlier={loadingEarlier}
        renderComposer={(props) => (
          <Composer
            {...props}
            textInputStyle={{
              color: '#000000',
              backgroundColor: '#ffffff',
              fontSize: 16,
              lineHeight: 20,
              paddingTop: 8,
              paddingBottom: 8,
              paddingHorizontal: 12,
              marginHorizontal: 4,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: '#e0e0e0',
              minHeight: 40,
            }}
            placeholder="Type a message..."
            placeholderTextColor="#999"
            multiline={true}
          />
        )}
        minInputToolbarHeight={56}
        minComposerHeight={40}
        bottomOffset={0}
        keyboardShouldPersistTaps="handled"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  // Header Styles
  headerLeftContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginLeft: 8,
    marginRight: 10,
    backgroundColor: '#e5e7eb',
  },
  headerTextContainer: {
    flexDirection: 'column',
  },
  headerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  headerPropertyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  headerPropertyText: {
    fontSize: 11,
    color: COLORS.primary,
    marginLeft: 3,
    fontWeight: '500',
  },
  headerRightContainer: {
    flexDirection: 'row',
    marginRight: 8,
  },
  headerIcon: {
    padding: 8,
    marginLeft: 4,
  },
  // Message Styles
  messagesContainer: {
    backgroundColor: '#f5f5f5',
    paddingBottom: 10,
  },
  inputToolbar: {
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    backgroundColor: '#fff',
    paddingVertical: 4,
    paddingHorizontal: 4,
    minHeight: 56,
  },
  inputToolbarPrimary: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  sendButton: {
    marginRight: 10,
    marginBottom: 5,
    justifyContent: 'center',
    alignItems: 'center',
    width: 44,
    height: 44,
  },
  actionsContainer: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
    marginRight: 4,
    marginBottom: 0,
  },
  propertyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 10,
    maxWidth: 150,
  },
  propertyName: {
    fontSize: 12,
    color: COLORS.primary,
    marginLeft: 4,
    fontWeight: '600',
  },
  refreshBanner: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  refreshText: {
    marginLeft: 8,
    color: COLORS.dark,
    fontSize: 13,
  },
});
