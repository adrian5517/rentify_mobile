// Rentify API Configuration
export const API_URL = 'https://rentify-server-ge0f.onrender.com/api';
export const ML_API_URL = 'https://new-train-ml.onrender.com';
export const UPLOAD_URL = 'https://rentify-server-ge0f.onrender.com/upload';

// API Endpoints
export const ENDPOINTS = {
  // Authentication
  AUTH: {
    REGISTER: '/auth/register',
    LOGIN: '/auth/login',
  },
  
  // Properties
  PROPERTIES: {
    GET_ALL: '/properties',
    GET_BY_ID: (id) => `/properties/${id}`,
    CREATE: '/properties',
    UPDATE: (id) => `/properties/${id}`,
    DELETE: (id) => `/properties/${id}`,
    GET_USER_PROPERTIES: (userId) => `/properties/user/${userId}`,
    SEARCH: '/properties/search',
  },
  
  // Users
  USERS: {
    PROFILE: '/users/profile',
  },
  
  // Messages
  MESSAGES: {
    CONVERSATIONS: '/messages/conversations',
    SEND: '/messages',
  },
  
  // Booking
  BOOKING: {
    CREATE: '/booking',
    GET_ALL: '/booking',
    GET_BY_ID: (id) => `/booking/${id}`,
    UPDATE: (id) => `/booking/${id}`,
    CANCEL: (id) => `/booking/${id}/cancel`,
    DELETE: (id) => `/booking/${id}`,
  },
  
  // ML Clustering
  ML: {
    PREDICT_KMEANS: '/predict_kmeans',
  },
};

// Cluster Classification
export const CLUSTERS = {
  LOW_BUDGET: { id: 0, label: 'Low Budget', range: '₱2,000 - ₱4,000', color: '#4CAF50' },
  MID_RANGE: { id: 1, label: 'Mid Range', range: '₱4,001 - ₱7,000', color: '#FFC107' },
  HIGH_END: { id: 2, label: 'High End', range: '₱7,001+', color: '#E91E63' },
  ALL: { id: 3, label: 'All Properties', color: '#2563eb' },
};