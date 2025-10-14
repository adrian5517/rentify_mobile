# 🗺️ Maps.jsx API Integration Example

## How to Update Maps.jsx to Use New API Service

### Step 1: Add Import at the Top

```jsx
// Add this import at the top of Maps.jsx
import propertyService from '../../services/propertyService';
```

### Step 2: Replace the Fetch Function

**OLD CODE (Lines 166-377):**
```jsx
// OLD: Direct API calls with complex error handling
useEffect(() => {
  const fetchAndClusterProperties = async () => {
    if (!location) return;
    
    setLoadingML(true);
    try {
      const propertiesRes = await fetch('https://rentify-server-ge0f.onrender.com/api/properties');
      const properties = await propertiesRes.json();
      
      // ... lots of ML classification code ...
      
      const classifiedProperties = await Promise.all(/* ... */);
      setMlProperties(classifiedProperties);
    } catch (error) {
      // ... error handling ...
    }
    setLoadingML(false);
  };
  
  fetchAndClusterProperties();
}, [location, refresh]);
```

**NEW CODE (Replace with this):**
```jsx
// NEW: Simple, clean API call using the service
useEffect(() => {
  const fetchAndClusterProperties = async () => {
    if (!location) {
      console.log('❌ No location available yet');
      return;
    }

    setLoadingML(true);
    console.log('🔄 Fetching clustered properties from API...');

    try {
      // Use the new property service - it handles everything!
      const result = await propertyService.getClusteredProperties({
        forceRefresh: refresh // Force refresh if user pulled to refresh
      });

      if (result.success && result.properties.length > 0) {
        console.log(`✅ Loaded ${result.properties.length} properties`);
        console.log('📊 Cluster distribution:', {
          'Low Budget': result.properties.filter(p => p.cluster === 0).length,
          'Mid Range': result.properties.filter(p => p.cluster === 1).length,
          'High End': result.properties.filter(p => p.cluster === 2).length,
        });
        
        setMlProperties(result.properties);
      } else {
        console.log('❌ No properties found');
        Alert.alert(
          'No Properties',
          'No properties are available at the moment. Please try again later.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('❌ Error fetching properties:', error);
      Alert.alert(
        'Connection Error',
        'Failed to load properties. Please check your internet connection and try again.',
        [{ text: 'Retry', onPress: () => setRefresh(!refresh) }]
      );
    } finally {
      setLoadingML(false);
    }
  };

  fetchAndClusterProperties();
}, [location, refresh]);
```

### What Changed?

✅ **Simpler**: One function call instead of hundreds of lines  
✅ **Automatic ML**: The service handles K-means classification  
✅ **Better errors**: Clear error messages for users  
✅ **Caching**: Properties cached for 5 minutes (faster loading)  
✅ **Fallback**: Automatic price-based clustering if ML fails  

---

## Step 3: Benefits You Get Automatically

### 1. Error Handling ✅
The service automatically handles:
- Network errors
- API errors
- Invalid responses
- Timeout errors

### 2. ML Clustering ✅
```jsx
// Properties now have these fields automatically:
{
  _id: "...",
  name: "Modern Apartment",
  price: 12000,
  cluster: 1,              // ← Automatically added! (0, 1, or 2)
  clusterLabel: "Mid Range", // ← Automatically added!
  location: { ... },
  images: [ ... ]
}
```

### 3. Caching ✅
```jsx
// First call: Fetches from API (slow)
await propertyService.getClusteredProperties();

// Second call within 5 minutes: Uses cache (instant!)
await propertyService.getClusteredProperties();

// Force refresh:
await propertyService.getClusteredProperties({ forceRefresh: true });
```

---

## Complete Updated Code Block

Replace lines 166-377 in Maps.jsx with this:

```jsx
// Fetch clustered properties from ML API using the new service
useEffect(() => {
  const fetchAndClusterProperties = async () => {
    if (!location) {
      console.log('❌ No location available yet, skipping property fetch');
      return;
    }

    setLoadingML(true);
    console.log('🔄 Starting property fetch and ML clustering...');

    try {
      // Use the integrated property service
      const result = await propertyService.getClusteredProperties({
        forceRefresh: refresh
      });

      if (result.success) {
        const { properties, count } = result;
        
        if (count > 0) {
          console.log(`✅ Successfully loaded ${count} properties`);
          
          // Log cluster distribution for debugging
          const clusterCounts = {
            'Low Budget (0)': properties.filter(p => p.cluster === 0).length,
            'Mid Range (1)': properties.filter(p => p.cluster === 1).length,
            'High End (2)': properties.filter(p => p.cluster === 2).length,
          };
          console.log('📊 Cluster distribution:', clusterCounts);
          
          setMlProperties(properties);
        } else {
          console.log('⚠️ No properties available');
          Alert.alert(
            'No Properties',
            'There are no rental properties available at the moment. Please try again later.',
            [
              { text: 'OK' },
              { text: 'Retry', onPress: () => setRefresh(!refresh) }
            ]
          );
        }
      } else {
        console.error('❌ Failed to fetch properties:', result.error);
        Alert.alert(
          'Error',
          result.error || 'Failed to load properties. Please try again.',
          [
            { text: 'Cancel' },
            { text: 'Retry', onPress: () => setRefresh(!refresh) }
          ]
        );
      }
    } catch (error) {
      console.error('❌ Unexpected error:', error);
      Alert.alert(
        'Connection Error',
        'Unable to connect to the server. Please check your internet connection.',
        [
          { text: 'Cancel' },
          { text: 'Retry', onPress: () => setRefresh(!refresh) }
        ]
      );
    } finally {
      setLoadingML(false);
    }
  };

  fetchAndClusterProperties();
}, [location, refresh]);
```

---

## Testing Your Changes

1. **Save Maps.jsx**
2. **Reload the app** (shake device → Reload)
3. **Watch console logs**:
   ```
   🔄 Starting property fetch and ML clustering...
   ✅ Successfully loaded 20 properties
   📊 Cluster distribution: { Low Budget: 5, Mid Range: 10, High End: 5 }
   ```

4. **Test features**:
   - ✅ Properties load on map
   - ✅ Cluster filters work
   - ✅ ML classification applied
   - ✅ Error handling works (try with no internet)

---

## Common Issues & Solutions

### Issue: "No properties found"
**Solution**: Check console logs. Service will show:
```
❌ No properties available
```
This means the backend has no properties. Add test data via web app.

### Issue: "Connection Error"
**Solution**: Check internet connection and API URL in `constant/api.js`

### Issue: Clusters not showing
**Solution**: Properties are being classified! Check if `selectedCluster` state is working.

---

## Next Steps

After updating Maps.jsx:

1. ✅ Test property loading
2. ✅ Test cluster filtering
3. ✅ Test offline behavior
4. Update List.jsx with similar pattern
5. Add property creation with image upload
6. Add authentication screens

---

## 🎉 You're Done!

Your Maps.jsx is now using the modern, integrated API service. Enjoy cleaner code and better performance!
