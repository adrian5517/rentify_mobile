import AsyncStorage from '@react-native-async-storage/async-storage';
import apiService from './apiService';

/**
 * Authentication Service
 * Handles user authentication and token management
 */

const TOKEN_KEY = '@rentify_auth_token';
const USER_KEY = '@rentify_user_data';

class AuthService {
  constructor() {
    this.currentUser = null;
    this.token = null;
  }

  /**
   * Initialize auth service (load saved token)
   */
  async initialize() {
    try {
      const token = await AsyncStorage.getItem(TOKEN_KEY);
      const userData = await AsyncStorage.getItem(USER_KEY);

      if (token && userData) {
        this.token = token;
        this.currentUser = JSON.parse(userData);
        apiService.setToken(token);
        
        console.log('✅ Auth initialized with saved token');
        return { success: true, user: this.currentUser };
      }

      return { success: false };
    } catch (error) {
      console.error('Error initializing auth:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Register new user
   */
  async register({ username, email, password, fullName, phoneNumber }) {
    try {
      const result = await apiService.register({
        username,
        email,
        password,
        fullName,
        phoneNumber,
      });

      if (result.success) {
        await this.saveAuthData(result.token, result.user);
        this.currentUser = result.user;
        this.token = result.token;
      }

      return result;
    } catch (error) {
      console.error('Registration error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Login user
   */
  async login({ email, password }) {
    try {
      const result = await apiService.login({ email, password });

      if (result.success) {
        await this.saveAuthData(result.token, result.user);
        this.currentUser = result.user;
        this.token = result.token;
      }

      return result;
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Logout user
   */
  async logout() {
    try {
      await AsyncStorage.removeItem(TOKEN_KEY);
      await AsyncStorage.removeItem(USER_KEY);
      
      apiService.clearToken();
      this.currentUser = null;
      this.token = null;

      console.log('✅ User logged out');
      return { success: true };
    } catch (error) {
      console.error('Logout error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get current user
   */
  getCurrentUser() {
    return this.currentUser;
  }

  /**
   * Get current token
   */
  getToken() {
    return this.token;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    return !!this.token && !!this.currentUser;
  }

  /**
   * Update user profile
   */
  async updateProfile(userData) {
    try {
      // Update local data
      this.currentUser = { ...this.currentUser, ...userData };
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(this.currentUser));

      return { success: true, user: this.currentUser };
    } catch (error) {
      console.error('Update profile error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get user profile from server
   */
  async fetchUserProfile() {
    try {
      const result = await apiService.getUserProfile();
      
      if (result.success) {
        this.currentUser = result.user;
        await AsyncStorage.setItem(USER_KEY, JSON.stringify(result.user));
      }

      return result;
    } catch (error) {
      console.error('Fetch profile error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Save auth data to AsyncStorage
   */
  async saveAuthData(token, user) {
    try {
      await AsyncStorage.setItem(TOKEN_KEY, token);
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
      console.log('✅ Auth data saved');
    } catch (error) {
      console.error('Error saving auth data:', error);
      throw error;
    }
  }

  /**
   * Validate email format
   */
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate password strength
   */
  isValidPassword(password) {
    // At least 8 characters, 1 uppercase, 1 lowercase, 1 number
    return password.length >= 8;
  }

  /**
   * Validate phone number (Philippine format)
   */
  isValidPhoneNumber(phone) {
    const phoneRegex = /^(\+63|0)9\d{9}$/;
    return phoneRegex.test(phone.replace(/\s/g, ''));
  }
}

export default new AuthService();
