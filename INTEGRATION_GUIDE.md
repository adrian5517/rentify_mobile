# 🎯 API Integration Guide

## 📦 What's Been Integrated

### ✅ Files Created/Updated:

1. **`constant/api.js`** - API configuration and endpoints
2. **`services/apiService.js`** - Main API service (singleton)
3. **`services/propertyService.js`** - Property-specific operations
4. **`services/authService.js`** - Authentication & user management
5. **`services/bookingServices.js`** - Updated with new integration

---

## 🚀 How to Use in Your App

### 1. Authentication Example

```jsx
import authService from './services/authService';

// In your login screen
const handleLogin = async () => {
  const result = await authService.login({
    email: 'user@example.com',
    password: 'password123',
  });

  if (result.success) {
    console.log('Logged in:', result.user);
    // Navigate to home screen
  } else {
    Alert.alert('Error', result.error);
  }
};

// Check if user is authenticated
useEffect(() => {
  const checkAuth = async () => {
    await authService.initialize();
    if (authService.isAuthenticated()) {
      console.log('User is logged in:', authService.getCurrentUser());
    }
  };
  checkAuth();
}, []);
```

### 2. Fetch Properties Example

```jsx
import propertyService from './services/propertyService';

// In your List.jsx or Maps.jsx
const fetchProperties = async () => {
  setLoading(true);
  
  const result = await propertyService.getAllProperties();
  
  if (result.success) {
    setProperties(result.properties);
  } else {
    Alert.alert('Error', result.error);
  }
  
  setLoading(false);
};

// With ML clustering
const fetchClusteredProperties = async () => {
  const result = await propertyService.getClusteredProperties();
  
  if (result.success) {
    setProperties(result.properties);
    // Properties now have cluster field (0, 1, 2)
  }
};
```

### 3. Create Property Example

```jsx
import propertyService from './services/propertyService';
import * as ImagePicker from 'expo-image-picker';

const handleCreateProperty = async () => {
  // 1. Pick images
  const imageResult = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsMultipleSelection: true,
    quality: 0.8,
  });

  if (imageResult.canceled) return;

  // 2. Upload images
  const uploadResult = await propertyService.uploadImages(
    imageResult.assets
  );

  if (!uploadResult.success) {
    Alert.alert('Error', 'Failed to upload images');
    return;
  }

  // 3. Create property
  const propertyData = {
    name: 'Modern Apartment',
    description: 'Beautiful apartment...',
    price: 12000,
    location: {
      address: 'Magsaysay Avenue, Naga City',
      latitude: 13.6218,
      longitude: 123.1815,
    },
    propertyType: 'apartment',
    amenities: ['WiFi', 'Parking', 'Security'],
    images: uploadResult.urls, // Cloudinary URLs
    phoneNumber: '+63 912 345 6789',
    status: 'available',
  };

  const result = await propertyService.createProperty(propertyData);

  if (result.success) {
    Alert.alert('Success', 'Property created!');
  } else {
    Alert.alert('Error', result.error);
  }
};
```

### 4. Update Maps.jsx to Use New API

Replace the existing fetch logic in Maps.jsx:

```jsx
import propertyService from '../../services/propertyService';

// Replace the fetchAndClusterProperties function
const fetchAndClusterProperties = async () => {
  if (!location) {
    console.log('❌ No location available yet');
    return;
  }

  setLoadingML(true);
  console.log('🔄 Fetching clustered properties...');

  try {
    // Use the new property service
    const result = await propertyService.getClusteredProperties();

    if (result.success && result.properties.length > 0) {
      console.log(`✅ Loaded ${result.properties.length} clustered properties`);
      setMlProperties(result.properties);
    } else {
      console.log('❌ No properties found');
      Alert.alert('Info', 'No properties available at the moment');
    }
  } catch (error) {
    console.error('❌ Error fetching properties:', error);
    Alert.alert('Error', 'Failed to load properties');
  } finally {
    setLoadingML(false);
  }
};
```

### 5. Search Properties Example

```jsx
import propertyService from './services/propertyService';

const handleSearch = async (query) => {
  const result = await propertyService.searchProperties({
    query: query,
    minPrice: 5000,
    maxPrice: 15000,
    propertyType: 'apartment',
    location: 'Naga',
  });

  if (result.success) {
    setSearchResults(result.properties);
  }
};
```

---

## 🔧 Quick Migration Checklist

### For Maps.jsx:
- [ ] Import `propertyService`
- [ ] Replace fetch logic with `propertyService.getClusteredProperties()`
- [ ] Remove redundant ML API calls (handled by service)
- [ ] Test clustering display

### For List.jsx:
- [ ] Import `propertyService`
- [ ] Replace fetch logic with `propertyService.getAllProperties()`
- [ ] Add search using `propertyService.searchProperties()`
- [ ] Test property list display

### For CreateProperty.jsx:
- [ ] Import `authService` and `propertyService`
- [ ] Check authentication: `authService.isAuthenticated()`
- [ ] Upload images: `propertyService.uploadImages()`
- [ ] Create property: `propertyService.createProperty()`
- [ ] Handle success/error states

### For Authentication Screens:
- [ ] Import `authService`
- [ ] Implement login: `authService.login()`
- [ ] Implement register: `authService.register()`
- [ ] Check auth state on app start: `authService.initialize()`
- [ ] Add logout: `authService.logout()`

---

## 📱 Complete Integration Example

Here's a complete example of how to integrate into your app:

```jsx
// App.jsx or _layout.tsx
import { useEffect, useState } from 'react';
import authService from './services/authService';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initializeApp = async () => {
      // Initialize auth service
      const result = await authService.initialize();
      setIsAuthenticated(result.success);
      setLoading(false);
    };

    initializeApp();
  }, []);

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer>
      {isAuthenticated ? (
        <MainNavigator />
      ) : (
        <AuthNavigator />
      )}
    </NavigationContainer>
  );
}
```

---

## 🎨 Benefits of This Integration

✅ **Centralized API logic** - All API calls in one place  
✅ **Error handling** - Automatic error handling and retries  
✅ **Token management** - Automatic auth token handling  
✅ **Caching** - Properties cached for 5 minutes  
✅ **ML clustering** - Integrated K-means classification  
✅ **Type safety** - Clear request/response formats  
✅ **Offline support** - Graceful degradation  
✅ **Easy testing** - Service layer is testable  

---

## 🐛 Troubleshooting

### Properties not loading?
```jsx
// Enable debug logging
const result = await propertyService.getAllProperties({ forceRefresh: true });
console.log('Result:', result);
```

### Authentication issues?
```jsx
// Check token
console.log('Token:', authService.getToken());
console.log('Is Auth:', authService.isAuthenticated());
```

### ML clustering not working?
The service automatically falls back to price-based clustering if ML API fails.

---

## 📞 Next Steps

1. **Install dependencies** (if not already installed):
   ```bash
   npm install @react-native-async-storage/async-storage
   npm install axios
   ```

2. **Test authentication flow**:
   - Implement login/register screens
   - Test token persistence

3. **Update existing screens**:
   - Replace fetch logic in Maps.jsx
   - Replace fetch logic in List.jsx
   - Update CreateProperty.jsx

4. **Add error boundaries**:
   - Wrap components with error handling
   - Show user-friendly error messages

5. **Test thoroughly**:
   - Test all API endpoints
   - Test offline behavior
   - Test ML clustering

---

## 🎉 You're Ready!

The API integration is complete and ready to use. Start by updating your authentication flow, then move to property listing and creation.

**Need help?** Check the API documentation in `MOBILE_API_DOCUMENTATION.md`
