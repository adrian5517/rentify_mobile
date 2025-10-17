import { io } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SOCKET_URL = 'https://rentify-server-ge0f.onrender.com';

class WebSocketService {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
    this.isConnecting = false;
  }

  async connect() {
    if (this.socket?.connected || this.isConnecting) {
      console.log('⚠️ WebSocket already connected or connecting');
      return;
    }

    try {
      this.isConnecting = true;
      
      // Get auth token from storage (using correct key 'token')
      const token = await AsyncStorage.getItem('token');
      
      if (!token) {
        console.log('⚠️ No authentication token found for WebSocket');
        // Continue anyway - backend may not require token for socket connection
        // this.isConnecting = false;
        // return;
      }

      console.log('🔌 Connecting to WebSocket...', token ? 'with token' : 'without token');

      // Initialize socket connection
      this.socket = io(SOCKET_URL, {
        auth: token ? { token } : {},
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000,
      });

      // Connection event handlers
      this.socket.on('connect', async () => {
        console.log('✅ WebSocket Connected:', this.socket.id);
        this.isConnecting = false;
        
        // Register user with socket server (using correct key 'user')
        try {
          const userJson = await AsyncStorage.getItem('user');
          if (userJson) {
            const user = JSON.parse(userJson);
            this.socket.emit('register', user._id);
            console.log('👤 User registered with socket:', user._id);
          }
        } catch (error) {
          console.error('Error registering user:', error);
        }
        
        this.notifyListeners('connection', { status: 'connected', socketId: this.socket.id });
      });

      this.socket.on('disconnect', (reason) => {
        console.log('❌ WebSocket Disconnected:', reason);
        this.isConnecting = false;
        this.notifyListeners('connection', { status: 'disconnected', reason });
      });

      this.socket.on('connect_error', (error) => {
        console.error('⚠️ Connection Error:', error.message);
        this.isConnecting = false;
        this.notifyListeners('connection', { status: 'error', error: error.message });
      });

      this.socket.on('reconnect', (attemptNumber) => {
        console.log('🔄 Reconnected after', attemptNumber, 'attempts');
        this.notifyListeners('connection', { status: 'reconnected', attempts: attemptNumber });
      });

      this.socket.on('reconnect_attempt', (attemptNumber) => {
        console.log('🔄 Reconnection attempt', attemptNumber);
      });

      this.socket.on('reconnect_error', (error) => {
        console.error('❌ Reconnection error:', error.message);
      });

      this.socket.on('reconnect_failed', () => {
        console.error('❌ Reconnection failed after maximum attempts');
        this.notifyListeners('connection', { status: 'failed' });
      });

      // Message events - Listen for your backend's "private-message" event
      this.socket.on('private-message', (message) => {
        console.log('📨 New private message received:', message);
        this.notifyListeners('message', message);
        this.notifyListeners('private-message', message);
      });

      // Keep backward compatibility with other event names
      this.socket.on('message', (message) => {
        console.log('📨 New message received:', message._id);
        this.notifyListeners('message', message);
      });

      this.socket.on('receive-message', (message) => {
        console.log('📨 Received message (receive-message event):', message);
        this.notifyListeners('message', message);
        this.notifyListeners('receive-message', message);
      });

      this.socket.on('typing', (data) => {
        console.log('⌨️ User typing:', data.userId);
        this.notifyListeners('typing', data);
      });

      this.socket.on('messageRead', (data) => {
        console.log('✓✓ Message read:', data.messageId);
        this.notifyListeners('messageRead', data);
      });

      // Alternative read event (for compatibility with guide)
      this.socket.on('messages-read', (data) => {
        console.log('✓✓ Messages read (messages-read event):', data);
        this.notifyListeners('messageRead', data);
        this.notifyListeners('messages-read', data);
      });

      // Conversation events
      this.socket.on('conversationUpdated', (data) => {
        console.log('🔄 Conversation updated:', data.conversationId);
        this.notifyListeners('conversationUpdated', data);
      });

    } catch (error) {
      console.error('❌ Failed to connect WebSocket:', error);
      this.isConnecting = false;
      throw error;
    }
  }

  disconnect() {
    if (this.socket) {
      console.log('🔌 Disconnecting WebSocket...');
      this.socket.disconnect();
      this.socket = null;
      this.isConnecting = false;
      this.notifyListeners('connection', { status: 'disconnected', reason: 'manual' });
    }
  }

  // Join a conversation room
  joinConversation(conversationId) {
    if (this.socket?.connected) {
      this.socket.emit('joinConversation', conversationId);
      console.log('✅ Joined conversation:', conversationId);
    } else {
      console.warn('⚠️ Cannot join conversation: Socket not connected');
    }
  }

  // Leave a conversation room
  leaveConversation(conversationId) {
    if (this.socket?.connected) {
      this.socket.emit('leaveConversation', conversationId);
      console.log('👋 Left conversation:', conversationId);
    }
  }

  // Send a message (via WebSocket for real-time)
  // Your backend expects: { senderId, receiverId, text, images }
  sendMessage(messageData) {
    if (this.socket?.connected) {
      // Format data for your backend's "private-message" event
      const formattedData = {
        senderId: messageData.senderId || messageData.sender,
        receiverId: messageData.receiverId || messageData.receiver || messageData.recipientId,
        text: messageData.text || messageData.content || messageData.message || '',
        images: messageData.images || messageData.imageUrls || [],
      };

      // Emit to your backend's "private-message" event
      this.socket.emit('private-message', formattedData);
      console.log('📤 Message sent via WebSocket (private-message):', formattedData);
      return true;
    } else {
      console.warn('⚠️ Cannot send message: Socket not connected');
      return false;
    }
  }

  // Mark messages as read (support multiple formats)
  markMessagesAsRead(messageIds, userId) {
    if (this.socket?.connected) {
      if (Array.isArray(messageIds)) {
        // Multiple messages
        this.socket.emit('mark-read', { messageIds, userId });
      } else {
        // Single message (backward compatibility)
        this.socket.emit('markAsRead', messageIds);
      }
      console.log('✓ Marked messages as read');
    }
  }

  // Emit typing status
  emitTyping(conversationIdOrPayload, isTyping) {
    if (!this.socket?.connected) return;

    // Accept either (conversationId, isTyping) or ({ conversationId, senderId, receiverId, isTyping })
    let payload = {};
    if (typeof conversationIdOrPayload === 'object') {
      payload = conversationIdOrPayload || {};
    } else {
      payload.conversationId = conversationIdOrPayload;
      payload.isTyping = isTyping;
    }

    // Normalize boolean
    payload.isTyping = !!payload.isTyping;

    try {
      // Emit conversation-shaped typing event
      const convPayload = { conversationId: payload.conversationId, isTyping: payload.isTyping };
      this.socket.emit('typing', convPayload);

      // Emit user-shaped typing event for backends expecting sender/receiver
      const userPayload = {
        senderId: payload.senderId || payload.sender || undefined,
        receiverId: payload.receiverId || payload.receiver || undefined,
        isTyping: payload.isTyping,
      };
      this.socket.emit('typing', userPayload);

      // Also emit a simple tuple-style event for older listeners (backward compatibility)
      this.socket.emit('typing-status', { conversationId: payload.conversationId, isTyping: payload.isTyping });
    } catch (err) {
      console.warn('emitTyping error', err);
    }
  }

  // Mark message as read
  markAsRead(messageId) {
    if (this.socket?.connected) {
      this.socket.emit('markAsRead', messageId);
    }
  }

  // Subscribe to events
  addEventListener(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
    
    // Return unsubscribe function
    return () => this.removeEventListener(event, callback);
  }

  // Unsubscribe from events
  removeEventListener(event, callback) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  // Notify all listeners
  notifyListeners(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in ${event} listener:`, error);
        }
      });
    }
  }

  // Check if connected
  isConnected() {
    return this.socket && this.socket.connected;
  }

  // Get socket ID
  getSocketId() {
    return this.socket?.id;
  }

  // Force reconnect
  async reconnect() {
    console.log('🔄 Manual reconnect requested');
    this.disconnect();
    await new Promise(resolve => setTimeout(resolve, 1000));
    await this.connect();
  }
}

// Export singleton instance
export default new WebSocketService();
