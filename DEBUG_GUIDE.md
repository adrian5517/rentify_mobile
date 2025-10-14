# 🐛 Debug Guide - Property Loading Issues

## Issue: "No ML properties available for filtering"

### Root Cause
The API response format was not being handled correctly, causing properties to be `undefined`.

---

## ✅ What Was Fixed

### 1. **Response Format Handling**
**Before:**
```jsx
const properties = await propertiesRes.json();
// This might return { properties: [...] } or just [...]
```

**After:**
```jsx
const data = await propertiesRes.json();

// Handle different response formats
let properties = [];
if (Array.isArray(data)) {
  properties = data;
} else if (data.properties && Array.isArray(data.properties)) {
  properties = data.properties;
} else if (data.success && data.properties) {
  properties = data.properties;
}
```

### 2. **Location Object Normalization**
**Before:**
```jsx
latitude: property.latitude || location.latitude
// This fails if property has location.latitude instead
```

**After:**
```jsx
const lat = property.location?.latitude || property.latitude || location.latitude;
const lng = property.location?.longitude || property.longitude || location.longitude;

// Normalize location object
location: property.location || {
  latitude: lat,
  longitude: lng,
  address: property.address || 'Naga City'
}
```

### 3. **Test Data Structure**
Updated test/fallback data to match expected API format:
```jsx
{
  _id: 'test1',
  name: 'Property Name',              // ✅ Changed from 'title'
  description: 'Description here',    // ✅ Added
  location: {                         // ✅ Structured object
    latitude: 13.6218,
    longitude: 123.1948,
    address: 'Full address'
  },
  propertyType: 'apartment',          // ✅ Changed from 'type'
  amenities: ['WiFi', 'Parking'],     // ✅ Added
  status: 'available',                // ✅ Added
  postedBy: 'Owner Name'              // ✅ Added
}
```

---

## 🔍 How to Debug

### Step 1: Check API Response
Add this to see what the API returns:

```jsx
const data = await propertiesRes.json();
console.log('🔍 Raw API response:', JSON.stringify(data).substring(0, 500));
console.log('🔍 Is array?', Array.isArray(data));
console.log('🔍 Has properties field?', !!data.properties);
```

### Step 2: Check Property Structure
```jsx
if (properties.length > 0) {
  console.log('🔍 First property:', JSON.stringify(properties[0], null, 2));
  console.log('🔍 Has location.latitude?', !!properties[0].location?.latitude);
  console.log('🔍 Has direct latitude?', !!properties[0].latitude);
}
```

### Step 3: Verify Cluster Assignment
```jsx
const clusteredProperties = await Promise.all(...);
console.log('🔍 Clustered properties:', clusteredProperties.map(p => ({
  id: p._id,
  name: p.name,
  cluster: p.cluster,
  hasLocation: !!p.location?.latitude
})));
```

---

## 📊 Expected Console Output (Success)

```
🔄 Starting K-means clustering...
📡 Fetching properties from backend...
✅ Fetched 20 properties from backend
📦 Sample property: {"_id":"67305d7cb78c9c0e26a3bb8f","name":"Modern Apartment"...
🧪 Testing K-means API connectivity...
✅ ML API test successful: {"cluster_id": 2, "cluster_label": "High End"}
🔄 Processing properties for K-means clustering...
📦 Processing batch 1/4
✅ Property Modern Apartment: cluster 1 (₱12000) [ML suggested: 1]
✅ Successfully clustered 20 properties
📊 Cluster distribution: {"Low Budget": 5, "Mid Range": 10, "High End": 5, "Total": 20}
🗺️ Showing all 20 properties (All Properties mode)
```

---

## ⚠️ Common Error Scenarios

### Scenario 1: Empty Response
```
❌ No properties found from backend, using test data
✅ Using test data with price-based clustering
📊 Test data: 5 properties
🗺️ Showing all 5 properties (All Properties mode)
```
**Solution:** Backend has no properties. Add test data via web app.

### Scenario 2: API Error
```
❌ Clustering error: Failed to fetch
🔄 Attempting fallback to properties without clustering...
❌ Fallback failed: Backend unreachable
```
**Solution:** Check internet connection and API URL.

### Scenario 3: ML API Fails
```
⚠️ ML API failed for property 67305d7c, using price fallback
✅ Property Modern Apartment: cluster 1 (₱12000) [ML suggested: fallback]
```
**Solution:** This is normal! App automatically falls back to price-based clustering.

---

## 🧪 Testing Checklist

### Test 1: Verify API Connection
```bash
# In terminal or browser
curl https://rentify-server-ge0f.onrender.com/api/properties
```

**Expected:** JSON array or object with properties

### Test 2: Check Response Format
Open browser console and run:
```javascript
fetch('https://rentify-server-ge0f.onrender.com/api/properties')
  .then(r => r.json())
  .then(data => {
    console.log('Type:', Array.isArray(data) ? 'Array' : 'Object');
    console.log('Keys:', Object.keys(data));
    console.log('Sample:', data[0] || data.properties?.[0]);
  });
```

### Test 3: Verify ML API
```bash
curl -X POST https://new-train-ml.onrender.com/predict_kmeans \
  -H "Content-Type: application/json" \
  -d '{"price":12000,"latitude":13.6218,"longitude":123.1815}'
```

**Expected:** `{"cluster_id": 1, "cluster_label": "Mid Range"}`

---

## 🔧 Quick Fixes

### Fix 1: Force Test Data
If backend is down, force test data:

```jsx
// In Maps.jsx, change line ~172
if (true) { // Force test data
  console.log('❌ Forcing test data for development');
  // ... test data code
  return;
}
```

### Fix 2: Clear Cache and Reload
```jsx
// In Expo app, shake device
// → Reload
// or press 'r' in terminal
```

### Fix 3: Check Network
```jsx
import NetInfo from '@react-native-community/netinfo';

NetInfo.fetch().then(state => {
  console.log('📡 Connection type:', state.type);
  console.log('📡 Is connected?', state.isConnected);
});
```

---

## 📝 How Properties Should Look

### Backend Response Format (Option 1 - Array)
```json
[
  {
    "_id": "67305d7cb78c9c0e26a3bb8f",
    "name": "Modern Apartment",
    "description": "Beautiful 2-bedroom apartment",
    "price": 12000,
    "location": {
      "address": "Magsaysay Avenue, Naga City",
      "latitude": 13.6218,
      "longitude": 123.1815
    },
    "images": ["url1", "url2"],
    "propertyType": "apartment",
    "amenities": ["WiFi", "Parking"],
    "status": "available",
    "postedBy": {
      "_id": "user_id",
      "fullName": "Maria Santos"
    }
  }
]
```

### Backend Response Format (Option 2 - Object)
```json
{
  "success": true,
  "count": 20,
  "properties": [
    { /* same as above */ }
  ]
}
```

### After ML Clustering (What You Get)
```javascript
{
  _id: "67305d7cb78c9c0e26a3bb8f",
  name: "Modern Apartment",
  price: 12000,
  cluster: 1,              // ← Added by ML
  clusterLabel: "Mid Range", // ← Added (if using service)
  location: {
    latitude: 13.6218,
    longitude: 123.1815,
    address: "Magsaysay Avenue, Naga City"
  }
  // ... rest of fields
}
```

---

## 🎯 Success Indicators

### ✅ Everything Working:
```
✅ Fetched 20 properties from backend
✅ ML API test successful
✅ Successfully clustered 20 properties
📊 Cluster distribution: {Low: 5, Mid: 10, High: 5}
🗺️ Showing all 20 properties (All Properties mode)
🗺️ Added 21 markers (20 properties + 1 user location)
```

### ✅ Working with Test Data:
```
❌ No properties found from backend, using test data
✅ Using test data with price-based clustering
📊 Test data: 5 properties
🗺️ Showing all 5 properties (All Properties mode)
🗺️ Added 6 markers (5 properties + 1 user location)
```

### ✅ Working with Fallback:
```
⚠️ No clustered properties found, creating fallback data
🗺️ Showing all 3 properties (All Properties mode)
```

---

## 🚨 Critical Errors to Watch For

### Error: "Cannot read property 'latitude' of undefined"
**Cause:** Property doesn't have location object
**Fix:** ✅ Already fixed! Code now normalizes location structure

### Error: "properties.length is undefined"
**Cause:** API response not parsed correctly
**Fix:** ✅ Already fixed! Code handles different response formats

### Error: "Network request failed"
**Cause:** Backend unreachable or no internet
**Fix:** Check internet, backend URL, or use test data

---

## 📞 Still Having Issues?

### 1. Enable Detailed Logging
Set this at the top of Maps.jsx:
```jsx
const DEBUG_MODE = true;

if (DEBUG_MODE) {
  console.log('🐛 Debug mode enabled');
}
```

### 2. Check These Files
- `constant/api.js` - API URLs correct?
- `services/apiService.js` - Token set?
- `app/(tabs)/Maps.jsx` - Latest version?

### 3. Restart Everything
```bash
# Stop Expo
Ctrl + C

# Clear cache
npx expo start -c

# Or
npm start -- --reset-cache
```

---

## 🎉 You Should Now See

1. ✅ Properties loading on map
2. ✅ Cluster filters working (Low/Mid/High/All)
3. ✅ No "undefined latitude" errors
4. ✅ Markers displaying correctly
5. ✅ Console showing success messages

**If still having issues, check the console logs and compare with expected output above!**
