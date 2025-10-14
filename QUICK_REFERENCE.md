# 🚀 Quick Reference - Rentify API Integration

## 📦 Import Statements

```jsx
// Authentication
import authService from './services/authService';

// Properties
import propertyService from './services/propertyService';

// Booking
import { bookingService } from './services/bookingServices';

// Direct API (advanced use)
import apiService from './services/apiService';
```

---

## 🔐 Authentication

### Login
```jsx
const result = await authService.login({
  email: 'user@example.com',
  password: 'password123'
});

if (result.success) {
  console.log('User:', result.user);
  console.log('Token:', result.token);
}
```

### Register
```jsx
const result = await authService.register({
  username: 'maria_santos',
  email: 'maria@example.com',
  password: 'SecurePass123!',
  fullName: 'Maria Santos',
  phoneNumber: '+63 917 234 5678'
});
```

### Logout
```jsx
await authService.logout();
```

### Check Auth Status
```jsx
const isAuth = authService.isAuthenticated();
const currentUser = authService.getCurrentUser();
const token = authService.getToken();
```

### Initialize on App Start
```jsx
useEffect(() => {
  const init = async () => {
    const result = await authService.initialize();
    if (result.success) {
      console.log('Auto-logged in:', result.user);
    }
  };
  init();
}, []);
```

---

## 🏠 Properties

### Get All Properties
```jsx
const result = await propertyService.getAllProperties();

if (result.success) {
  console.log('Properties:', result.properties);
  console.log('Count:', result.count);
}
```

### Get Clustered Properties (with ML)
```jsx
const result = await propertyService.getClusteredProperties();

// Each property now has cluster field
result.properties.forEach(property => {
  console.log(property.name, '- Cluster:', property.cluster);
  // cluster: 0 = Low Budget, 1 = Mid Range, 2 = High End
});
```

### Force Refresh (Bypass Cache)
```jsx
const result = await propertyService.getAllProperties({
  forceRefresh: true
});
```

### Get Property by ID
```jsx
const result = await propertyService.getPropertyDetails('property_id_here');

if (result.success) {
  console.log('Property:', result.property);
}
```

### Search Properties
```jsx
const result = await propertyService.searchProperties({
  query: 'apartment',
  minPrice: 5000,
  maxPrice: 15000,
  propertyType: 'apartment',
  location: 'Naga'
});
```

### Filter by Cluster
```jsx
const allProperties = await propertyService.getClusteredProperties();
const lowBudget = propertyService.filterByCluster(allProperties.properties, 0);
const midRange = propertyService.filterByCluster(allProperties.properties, 1);
const highEnd = propertyService.filterByCluster(allProperties.properties, 2);
const all = propertyService.filterByCluster(allProperties.properties, 3);
```

### Add Distance to Properties
```jsx
const userLocation = { latitude: 13.6218, longitude: 123.1815 };
const propertiesWithDistance = propertyService.addDistanceToProperties(
  properties,
  userLocation
);
```

### Sort Properties
```jsx
// Sort by distance
const sortedByDistance = propertyService.sortByDistance(properties);

// Sort by price (ascending)
const sortedByPriceLow = propertyService.sortByPrice(properties, 'asc');

// Sort by price (descending)
const sortedByPriceHigh = propertyService.sortByPrice(properties, 'desc');
```

---

## 📝 Create/Update Property

### Upload Images First
```jsx
import * as ImagePicker from 'expo-image-picker';

// 1. Pick images
const result = await ImagePicker.launchImageLibraryAsync({
  mediaTypes: ImagePicker.MediaTypeOptions.Images,
  allowsMultipleSelection: true,
  quality: 0.8,
});

if (!result.canceled) {
  // 2. Upload to Cloudinary
  const uploadResult = await propertyService.uploadImages(result.assets);
  
  if (uploadResult.success) {
    console.log('Image URLs:', uploadResult.urls);
  }
}
```

### Create Property
```jsx
const result = await propertyService.createProperty({
  name: 'Modern Apartment',
  description: 'Beautiful 2-bedroom apartment...',
  price: 12000,
  location: {
    address: 'Magsaysay Avenue, Naga City',
    latitude: 13.6218,
    longitude: 123.1815
  },
  propertyType: 'apartment',
  amenities: ['WiFi', 'Parking', 'Security'],
  images: ['url1', 'url2'], // From uploadImages()
  phoneNumber: '+63 912 345 6789',
  status: 'available'
});

if (result.success) {
  console.log('Created:', result.property);
}
```

### Update Property
```jsx
const result = await propertyService.updateProperty('property_id', {
  name: 'Updated Name',
  price: 13000,
  status: 'rented'
});
```

### Delete Property
```jsx
const result = await propertyService.deleteProperty('property_id');
```

### Get User's Properties
```jsx
const result = await propertyService.getUserProperties('user_id');
```

---

## 📅 Booking

### Create Booking
```jsx
const result = await bookingService.create({
  propertyId: 'property_id',
  startDate: '2025-10-15',
  endDate: '2025-10-30',
  message: 'I would like to book this property'
});
```

### Get All Bookings
```jsx
const result = await bookingService.getAll();
if (result.success) {
  console.log('Bookings:', result.bookings);
}
```

### Cancel Booking
```jsx
const result = await bookingService.cancel('booking_id');
```

---

## 🎨 Cluster Constants

```jsx
import { CLUSTERS } from './constant/api';

console.log(CLUSTERS.LOW_BUDGET);
// { id: 0, label: 'Low Budget', range: '₱2,000 - ₱4,000', color: '#4CAF50' }

console.log(CLUSTERS.MID_RANGE);
// { id: 1, label: 'Mid Range', range: '₱4,001 - ₱7,000', color: '#FFC107' }

console.log(CLUSTERS.HIGH_END);
// { id: 2, label: 'High End', range: '₱7,001+', color: '#E91E63' }

console.log(CLUSTERS.ALL);
// { id: 3, label: 'All Properties', color: '#2563eb' }
```

---

## ⚠️ Error Handling Pattern

```jsx
const handleAction = async () => {
  setLoading(true);
  
  const result = await propertyService.getAllProperties();
  
  if (result.success) {
    // Success
    setProperties(result.properties);
  } else {
    // Error
    Alert.alert('Error', result.error);
  }
  
  setLoading(false);
};
```

---

## 🔍 Debugging

### Check if User is Logged In
```jsx
console.log('Is Authenticated:', authService.isAuthenticated());
console.log('Current User:', authService.getCurrentUser());
console.log('Token:', authService.getToken());
```

### Check API Response
```jsx
const result = await propertyService.getAllProperties();
console.log('Success:', result.success);
console.log('Properties:', result.properties);
console.log('Error:', result.error);
```

### Force Refresh Cache
```jsx
propertyService.clearCache();
const result = await propertyService.getAllProperties({ forceRefresh: true });
```

### Test ML API Directly
```jsx
const result = await apiService.predictCluster({
  price: 12000,
  latitude: 13.6218,
  longitude: 123.1815
});
console.log('Cluster:', result.clusterId); // 0, 1, or 2
console.log('Label:', result.clusterLabel); // "Low Budget", etc.
```

---

## 📱 Common Use Cases

### Load Properties on Screen Mount
```jsx
useEffect(() => {
  const loadProperties = async () => {
    setLoading(true);
    const result = await propertyService.getClusteredProperties();
    if (result.success) {
      setProperties(result.properties);
    }
    setLoading(false);
  };
  
  loadProperties();
}, []);
```

### Pull-to-Refresh
```jsx
const [refreshing, setRefreshing] = useState(false);

const onRefresh = async () => {
  setRefreshing(true);
  const result = await propertyService.getAllProperties({
    forceRefresh: true
  });
  if (result.success) {
    setProperties(result.properties);
  }
  setRefreshing(false);
};

// In your ScrollView:
<ScrollView
  refreshControl={
    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
  }
>
  {/* content */}
</ScrollView>
```

### Search with Debounce
```jsx
import { useState, useEffect } from 'react';

const [searchQuery, setSearchQuery] = useState('');
const [searchResults, setSearchResults] = useState([]);

useEffect(() => {
  const delaySearch = setTimeout(async () => {
    if (searchQuery) {
      const result = await propertyService.searchProperties({
        query: searchQuery
      });
      if (result.success) {
        setSearchResults(result.properties);
      }
    }
  }, 500); // 500ms debounce

  return () => clearTimeout(delaySearch);
}, [searchQuery]);
```

---

## 🎯 Complete Example - Property List Screen

```jsx
import React, { useState, useEffect } from 'react';
import { View, FlatList, RefreshControl, Alert } from 'react-native';
import propertyService from './services/propertyService';

export default function PropertyListScreen() {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCluster, setSelectedCluster] = useState(3); // All

  // Initial load
  useEffect(() => {
    loadProperties();
  }, []);

  // Load properties
  const loadProperties = async () => {
    setLoading(true);
    const result = await propertyService.getClusteredProperties();
    
    if (result.success) {
      setProperties(result.properties);
    } else {
      Alert.alert('Error', result.error);
    }
    
    setLoading(false);
  };

  // Refresh
  const onRefresh = async () => {
    setRefreshing(true);
    await loadProperties();
    setRefreshing(false);
  };

  // Filter by cluster
  const filteredProperties = propertyService.filterByCluster(
    properties,
    selectedCluster
  );

  return (
    <View style={{ flex: 1 }}>
      {/* Cluster buttons */}
      <View style={{ flexDirection: 'row' }}>
        {['Low Budget', 'Mid Range', 'High End', 'All'].map((label, idx) => (
          <TouchableOpacity
            key={idx}
            onPress={() => setSelectedCluster(idx)}
            style={{
              backgroundColor: selectedCluster === idx ? '#8B5CF6' : '#fff'
            }}
          >
            <Text>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Property list */}
      <FlatList
        data={filteredProperties}
        renderItem={({ item }) => <PropertyCard property={item} />}
        keyExtractor={(item) => item._id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      />
    </View>
  );
}
```

---

## 📞 Need Help?

- **Full API Docs**: `MOBILE_API_DOCUMENTATION.md`
- **Integration Guide**: `INTEGRATION_GUIDE.md`
- **Maps Example**: `MAPS_UPDATE_EXAMPLE.md`
- **Summary**: `API_INTEGRATION_SUMMARY.md`

**Quick Start**: Install axios, update Maps.jsx, test! 🚀
