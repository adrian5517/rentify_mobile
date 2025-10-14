import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL, ML_API_URL, UPLOAD_URL, ENDPOINTS } from '../constant/api';

/**
 * Rentify API Service
 * Comprehensive API integration for React Native mobile app
 */

class RentifyApiService {
  constructor() {
    this.token = null;
    
    // Create axios instance
    this.api = axios.create({
      baseURL: API_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add token
    this.api.interceptors.request.use(
      (config) => {
        if (this.token) {
          config.headers.Authorization = `Bearer ${this.token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for error handling
    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response) {
          // Server responded with error
          const { status, data } = error.response;
          
          switch (status) {
            case 400:
              throw new Error(data.message || 'Bad request');
            case 401:
              throw new Error('Unauthorized. Please login again');
            case 403:
              throw new Error('You don\'t have permission');
            case 404:
              throw new Error('Resource not found');
            case 500:
              throw new Error('Server error. Please try again later');
            default:
              throw new Error(data.message || 'An error occurred');
          }
        } else if (error.request) {
          // Request made but no response
          throw new Error('No internet connection');
        } else {
          // Something else happened
          throw new Error(error.message || 'Unknown error');
        }
      }
    );
  }

  /**
   * Set authentication token
   */
  setToken(token) {
    this.token = token;
  }

  /**
   * Clear authentication token
   */
  clearToken() {
    this.token = null;
  }

  // ==================== Authentication ====================

  /**
   * Register new user
   */
  async register({ username, email, password, fullName, phoneNumber }) {
    try {
      const response = await this.api.post(ENDPOINTS.AUTH.REGISTER, {
        username,
        email,
        password,
        fullName,
        phoneNumber,
      });

      const { token, user } = response.data;
      this.setToken(token);
      
      return { success: true, token, user };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Login user
   */
  async login({ email, password }) {
    try {
      const response = await this.api.post(ENDPOINTS.AUTH.LOGIN, {
        email,
        password,
      });

      const { token, user } = response.data;
      this.setToken(token);
      
      return { success: true, token, user };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Logout user
   */
  logout() {
    this.clearToken();
  }

  // ==================== Properties ====================

  /**
   * Get all properties
   */
  async getProperties() {
    try {
      console.log('🔍 apiService: Calling GET', ENDPOINTS.PROPERTIES.GET_ALL);
      const response = await this.api.get(ENDPOINTS.PROPERTIES.GET_ALL);
      console.log('🔍 apiService: Response status:', response.status);
      console.log('🔍 apiService: Response data type:', typeof response.data);
      console.log('🔍 apiService: Response data:', JSON.stringify(response.data).substring(0, 300));
      
      const data = response.data;

      // Handle different response formats
      let properties = [];
      if (Array.isArray(data)) {
        properties = data;
        console.log('✅ Data is array, length:', properties.length);
      } else if (data.properties && Array.isArray(data.properties)) {
        properties = data.properties;
        console.log('✅ Data has properties field, length:', properties.length);
      } else if (data.success && data.properties) {
        properties = data.properties;
        console.log('✅ Data has success + properties, length:', properties.length);
      } else {
        console.log('⚠️ Unknown data format:', Object.keys(data));
      }

      console.log('✅ apiService: Returning', properties.length, 'properties');
      return { success: true, properties, count: properties.length };
    } catch (error) {
      console.error('❌ apiService Error fetching properties:', error.message);
      return { success: false, error: error.message, properties: [] };
    }
  }

  /**
   * Get property by ID
   */
  async getPropertyById(id) {
    try {
      const response = await this.api.get(ENDPOINTS.PROPERTIES.GET_BY_ID(id));
      const property = response.data.property || response.data;
      
      return { success: true, property };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Create new property
   */
  async createProperty(propertyData) {
    try {
      const response = await this.api.post(ENDPOINTS.PROPERTIES.CREATE, propertyData);
      const property = response.data.property || response.data;
      
      return { success: true, property };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Update property
   */
  async updateProperty(id, propertyData) {
    try {
      const response = await this.api.put(ENDPOINTS.PROPERTIES.UPDATE(id), propertyData);
      const property = response.data.property || response.data;
      
      return { success: true, property };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete property
   */
  async deleteProperty(id) {
    try {
      await this.api.delete(ENDPOINTS.PROPERTIES.DELETE(id));
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get user's properties
   */
  async getUserProperties(userId) {
    try {
      const response = await this.api.get(ENDPOINTS.PROPERTIES.GET_USER_PROPERTIES(userId));
      const properties = response.data.properties || [];
      
      return { success: true, properties, count: properties.length };
    } catch (error) {
      return { success: false, error: error.message, properties: [] };
    }
  }

  /**
   * Search properties
   */
  async searchProperties({ query, minPrice, maxPrice, propertyType, location }) {
    try {
      const params = {};
      if (query) params.query = query;
      if (minPrice) params.minPrice = minPrice;
      if (maxPrice) params.maxPrice = maxPrice;
      if (propertyType) params.propertyType = propertyType;
      if (location) params.location = location;

      const response = await this.api.get(ENDPOINTS.PROPERTIES.SEARCH, { params });
      const properties = response.data.properties || [];
      
      return { success: true, properties, count: properties.length };
    } catch (error) {
      return { success: false, error: error.message, properties: [] };
    }
  }

  // ==================== Image Upload ====================

  /**
   * Upload images to Cloudinary
   */
  async uploadImages(images) {
    try {
      const formData = new FormData();
      
      images.forEach((image, index) => {
        const filename = image.uri.split('/').pop();
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : 'image/jpeg';
        
        formData.append('images', {
          uri: image.uri,
          name: filename || `image_${index}.jpg`,
          type,
        });
      });

      const response = await axios.post(UPLOAD_URL, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const urls = response.data.urls || [];
      return { success: true, urls };
    } catch (error) {
      console.error('Error uploading images:', error.message);
      return { success: false, error: error.message, urls: [] };
    }
  }

  // ==================== ML Clustering ====================

  /**
   * Predict property cluster using K-means ML API
   */
  async predictCluster({ price, latitude, longitude }) {
    try {
      const response = await axios.post(
        `${ML_API_URL}${ENDPOINTS.ML.PREDICT_KMEANS}`,
        {
          price,
          latitude,
          longitude,
        },
        {
          timeout: 10000,
        }
      );

      const { cluster_id, cluster_label } = response.data;
      return { success: true, clusterId: cluster_id, clusterLabel: cluster_label };
    } catch (error) {
      console.warn('ML API failed, using price-based fallback:', error.message);
      
      // Price-based fallback
      let clusterId;
      if (price <= 4000) {
        clusterId = 0; // Low Budget
      } else if (price <= 7000) {
        clusterId = 1; // Mid Range
      } else {
        clusterId = 2; // High End
      }
      
      const labels = ['Low Budget', 'Mid Range', 'High End'];
      return { 
        success: true, 
        clusterId, 
        clusterLabel: labels[clusterId],
        fallback: true 
      };
    }
  }

  /**
   * Classify all properties using ML
   */
  async classifyProperties(properties) {
    console.log(`🤖 Classifying ${properties.length} properties with K-means ML...`);
    
    const classifiedProperties = await Promise.all(
      properties.map(async (property) => {
        try {
          const result = await this.predictCluster({
            price: property.price || 0,
            latitude: property.location?.latitude || 13.6218,
            longitude: property.location?.longitude || 123.1815,
          });

          return {
            ...property,
            cluster: result.clusterId,
            clusterLabel: result.clusterLabel,
          };
        } catch (error) {
          // Fallback to price-based
          const price = property.price || 0;
          let cluster;
          if (price <= 4000) {
            cluster = 0;
          } else if (price <= 7000) {
            cluster = 1;
          } else {
            cluster = 2;
          }
          
          return { ...property, cluster };
        }
      })
    );

    console.log(`✅ Classified ${classifiedProperties.length} properties`);
    return classifiedProperties;
  }

  // ==================== User Profile ====================

  /**
   * Get current user profile
   */
  async getUserProfile() {
    try {
      const response = await this.api.get(ENDPOINTS.USERS.PROFILE);
      const user = response.data.user || response.data;
      
      return { success: true, user };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ==================== Messages ====================

  /**
   * Get all conversations for current user
   * Web implementation: Fetch all users, then check who has messages
   */
  async getConversations() {
    try {
      // Get current user from AsyncStorage (stored during login)
      const userStr = await AsyncStorage.getItem('user');
      if (!userStr) {
        return { success: false, error: 'Not authenticated', conversations: [] };
      }
      
      const user = JSON.parse(userStr);
      const userId = user._id;

      console.log(`📥 Building conversations list for user: ${userId}`);
      
      // Step 1: Fetch all users using getAllUsers method
      const usersResult = await this.getAllUsers();
      if (!usersResult.success) {
        console.error('❌ Failed to fetch users:', usersResult.error);
        return { success: false, error: usersResult.error, conversations: [] };
      }
      
      const allUsers = usersResult.users || [];
      console.log(`👥 Found ${allUsers.length} total users`);
      
      // Step 2: For each user, check if there are messages
      const conversationsWithMessages = [];
      
      for (const otherUser of allUsers) {
        // Skip self
        if (otherUser._id === userId) continue;
        
        try {
          // Fetch messages between current user and this user
          const messagesResponse = await this.api.get(`/messages/${userId}/${otherUser._id}`);
          const messages = messagesResponse.data || [];
          
          // If there are messages, add to conversations
          if (messages.length > 0) {
            const lastMessage = messages[messages.length - 1];
            
            conversationsWithMessages.push({
              id: otherUser._id,
              otherUser: {
                _id: otherUser._id,
                name: otherUser.fullName || otherUser.username,
                username: otherUser.username,
                profilePicture: otherUser.profilePicture,
                email: otherUser.email
              },
              lastMessage: {
                _id: lastMessage._id,
                message: lastMessage.message,
                sender: lastMessage.sender,
                createdAt: lastMessage.createdAt
              },
              unreadCount: 0, // Calculate if needed
              updatedAt: lastMessage.createdAt,
              lastMessageTime: new Date(lastMessage.createdAt).getTime()
            });
          }
        } catch (error) {
          // Skip this user if error fetching messages (404 means no messages)
          if (error.response?.status !== 404) {
            console.log(`⚠️ Error checking messages with user ${otherUser.username}:`, error.message);
          }
        }
      }
      
      // Step 3: Sort by most recent message
      conversationsWithMessages.sort((a, b) => b.lastMessageTime - a.lastMessageTime);
      
      console.log(`✅ Found ${conversationsWithMessages.length} conversations`);
      
      return { 
        success: true, 
        conversations: conversationsWithMessages
      };
    } catch (error) {
      console.error('❌ Error building conversations:', error.response?.data || error.message);
      
      return { 
        success: false, 
        error: error.response?.data?.message || error.message, 
        conversations: [] 
      };
    }
  }

  /**
   * Get all users (for contacts list)
   */
  async getAllUsers() {
    try {
      const response = await this.api.get('/auth/users');
      return { success: true, users: response.data.users || [] };
    } catch (error) {
      return { success: false, error: error.message, users: [] };
    }
  }

  /**
   * Get messages between current user and another user
   * Backend endpoint: GET /api/messages/:userId1/:otherUserId
   */
  async getMessagesBetweenUsers(otherUserId) {
    try {
      // Get current user from AsyncStorage (stored during login)
      const userStr = await AsyncStorage.getItem('user');
      if (!userStr) {
        return { success: false, error: 'Not authenticated', messages: [] };
      }
      const user = JSON.parse(userStr);
      const userId = user._id;

      // Call backend endpoint: /messages/:userId1/:otherUserId
      const response = await this.api.get(`/messages/${userId}/${otherUserId}`);
      return { success: true, messages: response.data || [], data: response.data };
    } catch (error) {
      return { success: false, error: error.message, messages: [] };
    }
  }

  /**
   * Get unread message count for current user
   */
  async getUnreadCount() {
    try {
      const response = await this.api.get('/messages/unread');
      return { success: true, count: response.data.count || 0 };
    } catch (error) {
      return { success: false, error: error.message, count: 0 };
    }
  }

  /**
   * Get messages in a conversation
   */
  async getMessages(conversationId) {
    try {
      const response = await this.api.get(`${ENDPOINTS.MESSAGES.CONVERSATION}/${conversationId}`);
      const messages = response.data.messages || [];
      
      return { success: true, messages };
    } catch (error) {
      return { success: false, error: error.message, messages: [] };
    }
  }

  /**
   * Send message
   * Backend endpoint: POST /api/messages/send
   * Backend expects: { senderId, receiverId, text }
   */
  async sendMessage({ recipientId, propertyId, content, text }) {
    try {
      // Get current user from AsyncStorage (stored during login)
      const userStr = await AsyncStorage.getItem('user');
      if (!userStr) {
        return { success: false, error: 'Not authenticated' };
      }
      const user = JSON.parse(userStr);

      // Format data for your backend
      const messageData = {
        senderId: user._id,
        receiverId: recipientId,
        text: text || content || '', // Support both 'text' and 'content'
      };

      // Call backend endpoint: POST /messages/send
      const response = await this.api.post('/messages/send', messageData);
      
      return { 
        success: true, 
        data: response.data,
        message: response.data // Alias for backward compatibility
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Mark messages as read
   * Backend endpoint: POST /api/messages/mark-read
   */
  async markAsRead(messageId) {
    try {
      await this.api.post('/messages/mark-read', { messageId });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get user profile
   */
  async getUserProfile() {
    try {
      const response = await this.api.get('/users/profile');
      const user = response.data.user;
      
      return { success: true, user };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

// Export singleton instance
export default new RentifyApiService();
