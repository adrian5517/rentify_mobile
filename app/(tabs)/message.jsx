import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Alert,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import ApiService from '../../services/apiService';
import WebSocketService from '../../services/websocketService';
import COLORS from '../../constant/colors';
import normalizeAvatar from '../../utils/normalizeAvatar';

export default function MessageScreen() {
  const router = useRouter();
  // Use same destructuring as profile tab for consistency
  const { user } = useAuthStore();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadConversations = async () => {
    try {
      setLoading(true);
      
      // Check if user is authenticated
      if (!user) {
        console.log('ℹ️ User not logged in - showing empty state');
        setConversations([]);
        setLoading(false);
        return;
      }
      
      console.log(`🔄 Loading conversations for user: ${user._id}`);
      const response = await ApiService.getConversations();
      
      console.log('📦 Response:', response);
      
      if (response.success) {
        const convos = response.conversations || [];
        const sorted = convos.sort((a, b) => 
          new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt)
        );
        setConversations(sorted);
        console.log(`✅ Loaded ${sorted.length} conversations`);
      } else {
        // Only log error, don't show alert to user for empty state
        console.error('❌ Failed to load conversations:', response.error);
        setConversations([]);
      }
    } catch (error) {
      console.error('❌ Error loading conversations:', error);
      Alert.alert('Error', 'Unable to load conversations. Please check your connection.');
      setConversations([]);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadConversations();
    setRefreshing(false);
  };

  useEffect(() => {
    const handleNewMessage = (message) => {
      console.log('📨 New message received in conversations list:', message);
      
      setConversations((prev) => {
        // Find if conversation with this user already exists
        const otherUserId = message.sender === user?._id 
          ? message.receiver 
          : message.sender;
        
        const existingIndex = prev.findIndex(conv => conv.otherUser._id === otherUserId);
        
        if (existingIndex !== -1) {
          // Update existing conversation
          const updated = [...prev];
          updated[existingIndex] = {
            ...updated[existingIndex],
            lastMessage: {
              _id: message._id,
              message: message.message,
              sender: message.sender,
              createdAt: message.createdAt
            },
            unreadCount: message.sender !== user?._id 
              ? updated[existingIndex].unreadCount + 1 
              : updated[existingIndex].unreadCount,
            updatedAt: message.createdAt,
            lastMessageTime: new Date(message.createdAt).getTime()
          };
          
          // Sort by most recent
          return updated.sort((a, b) => b.lastMessageTime - a.lastMessageTime);
        } else {
          // New conversation - will be picked up on next refresh
          loadConversations();
          return prev;
        }
      });
    };

    // Listen for both 'message' and 'private-message' events
    WebSocketService.addEventListener('message', handleNewMessage);
    WebSocketService.addEventListener('private-message', handleNewMessage);
    
    return () => {
      WebSocketService.removeEventListener('message', handleNewMessage);
      WebSocketService.removeEventListener('private-message', handleNewMessage);
    };
  }, [user]);

  useFocusEffect(useCallback(() => { loadConversations(); }, []));

  const formatTime = (date) => {
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (days > 7) return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (days > 0) return days + 'd ago';
    if (hours > 0) return hours + 'h ago';
    if (minutes > 0) return minutes + 'm ago';
    return 'Just now';
  };

  const renderConversation = ({ item }) => {
    // New format: item.otherUser contains the other person's info
    const otherUser = item.otherUser;
    const isUnread = item.unreadCount > 0;
    const timeString = item.lastMessage?.createdAt
      ? formatTime(new Date(item.lastMessage.createdAt))
      : '';

    // Defensive: ensure displayed name and last message are strings
    const otherUserNameSafe = (() => {
      const nameVal = otherUser?.name || otherUser?.fullName || otherUser?.username;
      if (!nameVal) return 'Unknown User';
      return typeof nameVal === 'string' ? nameVal : String(nameVal);
    })();

    const lastMessageText = (() => {
      const raw = item.lastMessage?.message || item.lastMessage?.text || item.lastMessage;
      if (raw == null) return 'No messages yet';
      if (typeof raw === 'string') return raw;
      if (typeof raw === 'object') {
        // Try common fields
        if (raw.text && typeof raw.text === 'string') return raw.text;
        if (raw.message && typeof raw.message === 'string') return raw.message;
        // Fallback to JSON safe string
        try {
          return JSON.stringify(raw);
        } catch {
          return 'New message';
        }
      }
      return String(raw);
    })();

    // Resolve avatar input from possible fields and normalize (matches profile logic)
  const avatarInput = otherUser?.profilePicture || otherUser?.profile_picture || otherUser?.avatar || otherUser?.picture || otherUser;
  let avatarUri = normalizeAvatar(avatarInput || '') || 'https://api.dicebear.com/7.x/avataaars/png?seed=default';

    return (
      <TouchableOpacity
        style={[styles.conversationItem, isUnread && styles.unreadItem]}
        onPress={() => {
          // Ensure otherUserName is a string to avoid rendering objects
          const otherUserNameSafe = (() => {
            const val = otherUser?.name || otherUser?.fullName || otherUser?.username || otherUser;
            if (!val) return 'User';
            if (typeof val === 'string') return val;
            return val.name || val.username || String(val);
          })();

          router.push({
            pathname: '/ChatScreen',
            params: {
              otherUserId: otherUser?._id,
              otherUserName: otherUserNameSafe,
              otherUserAvatar: avatarUri,
            },
          });
        }}
      >
        <Image 
          source={{ uri: avatarUri }} 
          style={styles.avatar} 
        />
        <View style={styles.conversationContent}>
          <View style={styles.conversationHeader}>
            <Text style={[styles.userName, isUnread && styles.unreadText]}>
              {otherUserNameSafe}
            </Text>
            {timeString && <Text style={styles.timeText}>{timeString}</Text>}
          </View>
          <View style={styles.lastMessageRow}>
            <Text
              style={[styles.lastMessage, isUnread && styles.unreadText]}
              numberOfLines={1}
            >
              {lastMessageText}
            </Text>
            {isUnread && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>{item.unreadCount}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <StatusBar barStyle="dark-content" />
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading conversations...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Messages</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity 
            style={styles.headerIcon} 
            onPress={() => router.push('/ContactsScreen')}
          >
            <Ionicons name="person-add-outline" size={24} color={COLORS.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIcon} onPress={() => WebSocketService.reconnect()}>
            <Ionicons name={WebSocketService.isConnected() ? "cloud-done" : "cloud-offline"} size={24} color={WebSocketService.isConnected() ? COLORS.primary : "#999"} />
          </TouchableOpacity>
        </View>
      </View>
      {conversations.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="chatbubbles-outline" size={80} color="#e0e0e0" />
          {!user ? (
            <>
              <Text style={styles.emptyText}>Please login first</Text>
              <Text style={styles.emptySubtext}>You need to be logged in to view your messages</Text>
            </>
          ) : (
            <>
              <Text style={styles.emptyText}>No conversations yet</Text>
              <Text style={styles.emptySubtext}>
                {`Start messaging property owners to see your conversations here.

Tap on a property in the Maps tab and click "Contact Owner" to start chatting!`}
              </Text>
            </>
          )}
        </View>
      ) : (
        <FlatList 
          data={conversations} 
          renderItem={renderConversation} 
          keyExtractor={(item) => item.id || item._id} 
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={onRefresh} 
              colors={[COLORS.primary]} 
            />
          } 
          contentContainerStyle={{ 
            paddingBottom: 20,
            paddingTop: 8,
          }} 
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#f5f7fa' 
  },
  centerContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    backgroundColor: '#f5f7fa', 
    padding: 20 
  },
  loadingText: { 
    marginTop: 12, 
    fontSize: 16, 
    color: '#6b7280',
    fontWeight: '500',
  },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 20, 
    paddingVertical: 16, 
    paddingTop: 50, 
    backgroundColor: '#fff', 
    borderBottomWidth: 1, 
    borderBottomColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  headerTitle: { 
    fontSize: 28, 
    fontWeight: '800', 
    color: '#111827', 
    letterSpacing: -0.5 
  },
  headerIcon: { 
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f5f7fa',
  },
  conversationItem: { 
    flexDirection: 'row', 
    padding: 16, 
    backgroundColor: '#fff', 
    borderBottomWidth: 1, 
    borderBottomColor: '#f0f0f0',
    marginHorizontal: 12,
    marginTop: 8,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  unreadItem: { 
    backgroundColor: '#eff6ff',
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  avatar: { 
    width: 56, 
    height: 56, 
    borderRadius: 28, 
    marginRight: 14, 
    backgroundColor: '#e5e7eb',
    borderWidth: 2,
    borderColor: '#fff',
  },
  conversationContent: { 
    flex: 1,
    justifyContent: 'center',
  },
  conversationHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 6 
  },
  userName: { 
    fontSize: 16, 
    fontWeight: '600', 
    color: '#111827', 
    flex: 1 
  },
  unreadText: { 
    fontWeight: '700', 
    color: '#1f2937' 
  },
  timeText: { 
    fontSize: 12, 
    color: '#9ca3af', 
    marginLeft: 8,
    fontWeight: '500',
  },
  propertyBadge: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#eff6ff', 
    paddingHorizontal: 8, 
    paddingVertical: 3, 
    borderRadius: 12, 
    marginBottom: 6, 
    alignSelf: 'flex-start' 
  },
  propertyName: { 
    fontSize: 12, 
    color: COLORS.primary, 
    marginLeft: 4, 
    fontWeight: '600' 
  },
  lastMessageRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between' 
  },
  lastMessage: { 
    flex: 1, 
    fontSize: 14, 
    color: '#6b7280',
    lineHeight: 20,
  },
  unreadBadge: { 
    backgroundColor: COLORS.primary, 
    borderRadius: 12, 
    minWidth: 24, 
    height: 24, 
    justifyContent: 'center', 
    alignItems: 'center', 
    paddingHorizontal: 8, 
    marginLeft: 8 
  },
  unreadBadgeText: { 
    color: '#fff', 
    fontSize: 12, 
    fontWeight: '700' 
  },
  emptyContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 40 
  },
  emptyText: { 
    fontSize: 20, 
    fontWeight: '700', 
    color: '#111827', 
    marginTop: 20, 
    marginBottom: 8 
  },
  emptySubtext: { 
    fontSize: 15, 
    color: '#6b7280', 
    textAlign: 'center', 
    lineHeight: 22 
  },
});
