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
import { useAuthStore } from '../store/authStore';
import normalizeAvatar from './utils/normalizeAvatar';
import COLORS from '../constant/colors';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ChatScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // Use same destructuring as profile tab for consistency
  const { user } = useAuthStore();
  const params = useLocalSearchParams();

  // use normalizeAvatar helper imported from app/utils/normalizeAvatar
  
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [conversationId, setConversationId] = useState(params.conversationId || null);
  
  // User and property details from navigation params
  const otherUserId = params.otherUserId;
  const otherUserName = params.otherUserName || 'User';
  let otherUserAvatar = params.otherUserAvatar;

  // Normalize passed avatar (allow dicebear and relative paths)
  if (otherUserAvatar) {
    if (otherUserAvatar.includes('api.dicebear.com') && otherUserAvatar.includes('/svg?')) {
      otherUserAvatar = otherUserAvatar.replace('/svg?', '/png?');
    }
    if (!otherUserAvatar.startsWith('http')) {
      otherUserAvatar = `https://rentify-server-ge0f.onrender.com${otherUserAvatar}`;
    }
  }
  const propertyId = params.propertyId;
  const propertyName = params.propertyName;

  // Load messages
  const loadMessages = useCallback(async () => {
    if (!otherUserId) {
      setLoading(false);
      return;
    }

    try {
      console.log('📩 Loading messages with user:', otherUserId);
      
      // Use getMessagesBetweenUsers which calls: /messages/:userId1/:otherUserId
      const response = await ApiService.getMessagesBetweenUsers(otherUserId);
      
      if (response.success) {
        // Your backend returns an array of messages directly
        const backendMessages = response.messages || response.data || [];
        
        // Format messages for GiftedChat
        const formattedMessages = backendMessages.map(msg => ({
          _id: msg._id,
          text: msg.message || '', // Your backend uses 'message' not 'content'
          createdAt: new Date(msg.createdAt),
          user: {
            _id: msg.sender?._id || msg.sender,
            name: msg.sender?.name || 'User',
            avatar: normalizeAvatar(msg.sender?.profilePicture || ''),
          },
          sent: true,
          received: msg.read,
          // Store images if any
          image: msg.imageUrls && msg.imageUrls.length > 0 ? msg.imageUrls[0] : undefined,
        })).reverse(); // GiftedChat expects newest first
        
        setMessages(formattedMessages);
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
    }
  }, [otherUserId]);

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

        setMessages(previousMessages =>
          GiftedChat.append(previousMessages, [formattedMessage])
        );

        // Mark as read if message is from other user
        if (isSentByOther) {
          ApiService.markAsRead(message._id);
        }
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

    // Cleanup
    return () => {
      WebSocketService.removeEventListener('message', handleNewMessage);
      WebSocketService.removeEventListener('private-message', handleNewMessage);
      WebSocketService.removeEventListener('typing', handleTyping);
    };
  }, [user, otherUserId, router, loadMessages]);

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
            avatar: normalizeAvatar(user.profilePicture || ''),
          },
          sent: true,
          received: false,
        };

        setMessages(previousMessages =>
          GiftedChat.append(previousMessages, [formattedMessage])
        );
      } else {
        console.error('❌ Failed to send message:', response.error);
        Alert.alert('Error', 'Failed to send message');
      }
    } catch (error) {
      console.error('❌ Error sending message:', error);
      Alert.alert('Error', 'Failed to send message');
    }
  }, [user, otherUserId]);

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
      const response = await fetch('https://rentify-server-ge0f.onrender.com/api/messages/send', {
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
            avatar: user.profilePicture,
          },
          sent: true,
          received: false,
        };

        setMessages(previousMessages =>
          GiftedChat.append(previousMessages, [formattedMessage])
        );

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
                    : (otherUserAvatar ? `https://rentify-server-ge0f.onrender.com${otherUserAvatar}` : 'https://api.dicebear.com/7.x/avataaars/png?seed=default')
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

      <GiftedChat
        messages={messages}
        onSend={messages => onSend(messages)}
        onInputTextChanged={handleInputTextChanged}
        user={{
          _id: user._id,
          name: user.name || user.username,
          avatar: normalizeAvatar(user.profilePicture || ''),
        }}
        renderBubble={renderBubble}
        renderInputToolbar={renderInputToolbar}
        renderSend={renderSend}
        renderActions={renderActions}
        alwaysShowSend
        scrollToBottom
        isTyping={isTyping}
        placeholder="Type a message..."
        showAvatarForEveryMessage={false}
        showUserAvatar={true}
        dateFormat="MMM D, YYYY"
        timeFormat="h:mm A"
        messagesContainerStyle={styles.messagesContainer}
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
});
