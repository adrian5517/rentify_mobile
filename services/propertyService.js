import apiService from './apiService';

/**
 * Property Service
 * High-level property operations with error handling and caching
 */

class PropertyService {
  constructor() {
    this.cachedProperties = [];
    this.lastFetchTime = null;
    this.cacheDuration = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Get all properties with optional caching
   */
  async getAllProperties({ forceRefresh = false } = {}) {
    try {
      // Return cached data if valid
      const now = Date.now();
      if (
        !forceRefresh &&
        this.cachedProperties.length > 0 &&
        this.lastFetchTime &&
        now - this.lastFetchTime < this.cacheDuration
      ) {
        console.log('📦 Using cached properties');
        return { 
          success: true, 
          properties: this.cachedProperties,
          cached: true 
        };
      }

      // Fetch from API
      console.log('🌐 Fetching properties from API...');
      const result = await apiService.getProperties();

      if (result.success) {
        this.cachedProperties = result.properties;
        this.lastFetchTime = now;
      }

      return result;
    } catch (error) {
      console.error('Error in getAllProperties:', error);
      return { success: false, error: error.message, properties: [] };
    }
  }

  /**
   * Get properties with ML clustering
   */
  async getClusteredProperties({ forceRefresh = false } = {}) {
    try {
      // Get all properties
      const result = await this.getAllProperties({ forceRefresh });
      
      if (!result.success || result.properties.length === 0) {
        return result;
      }

      // Classify properties using ML
      const classifiedProperties = await apiService.classifyProperties(result.properties);

      return {
        success: true,
        properties: classifiedProperties,
        count: classifiedProperties.length,
      };
    } catch (error) {
      console.error('Error in getClusteredProperties:', error);
      return { success: false, error: error.message, properties: [] };
    }
  }

  /**
   * Filter properties by cluster
   */
  filterByCluster(properties, clusterId) {
    if (clusterId === 3) {
      // Show all properties
      return properties;
    }
    
    return properties.filter(p => p.cluster === clusterId);
  }

  /**
   * Get property details by ID
   */
  async getPropertyDetails(propertyId) {
    try {
      return await apiService.getPropertyById(propertyId);
    } catch (error) {
      console.error('Error getting property details:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Create new property
   */
  async createProperty(propertyData) {
    try {
      const result = await apiService.createProperty(propertyData);
      
      if (result.success) {
        // Clear cache to force refresh
        this.clearCache();
      }
      
      return result;
    } catch (error) {
      console.error('Error creating property:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update property
   */
  async updateProperty(propertyId, propertyData) {
    try {
      const result = await apiService.updateProperty(propertyId, propertyData);
      
      if (result.success) {
        this.clearCache();
      }
      
      return result;
    } catch (error) {
      console.error('Error updating property:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete property
   */
  async deleteProperty(propertyId) {
    try {
      const result = await apiService.deleteProperty(propertyId);
      
      if (result.success) {
        this.clearCache();
      }
      
      return result;
    } catch (error) {
      console.error('Error deleting property:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Search properties
   */
  async searchProperties(searchParams) {
    try {
      return await apiService.searchProperties(searchParams);
    } catch (error) {
      console.error('Error searching properties:', error);
      return { success: false, error: error.message, properties: [] };
    }
  }

  /**
   * Upload property images
   */
  async uploadImages(images) {
    try {
      return await apiService.uploadImages(images);
    } catch (error) {
      console.error('Error uploading images:', error);
      return { success: false, error: error.message, urls: [] };
    }
  }

  /**
   * Get user's properties
   */
  async getUserProperties(userId) {
    try {
      return await apiService.getUserProperties(userId);
    } catch (error) {
      console.error('Error getting user properties:', error);
      return { success: false, error: error.message, properties: [] };
    }
  }

  /**
   * Calculate distance between two coordinates
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in kilometers
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Add distance to properties based on user location
   */
  addDistanceToProperties(properties, userLocation) {
    if (!userLocation) return properties;

    return properties.map(property => ({
      ...property,
      distance: this.calculateDistance(
        userLocation.latitude,
        userLocation.longitude,
        property.location?.latitude || 0,
        property.location?.longitude || 0
      ),
    }));
  }

  /**
   * Sort properties by distance
   */
  sortByDistance(properties) {
    return [...properties].sort((a, b) => (a.distance || 0) - (b.distance || 0));
  }

  /**
   * Sort properties by price
   */
  sortByPrice(properties, order = 'asc') {
    return [...properties].sort((a, b) => {
      const priceA = a.price || 0;
      const priceB = b.price || 0;
      return order === 'asc' ? priceA - priceB : priceB - priceA;
    });
  }

  /**
   * Clear cached data
   */
  clearCache() {
    this.cachedProperties = [];
    this.lastFetchTime = null;
    console.log('🗑️ Property cache cleared');
  }
}

export default new PropertyService();
