# Expo Frontend Integration — KNN Recommendations

This document provides a ready-to-drop-in React Native component (Expo) that gets device location, calls the Rentify `/ml` KNN endpoint, and displays recommendations in a `FlatList`.

Requirements
- Expo-managed project
- `expo-location` installed
- `axios` (optional) or `fetch` (used here)

Install packages:
```bash
expo install expo-location
npm install axios
```

Configuration
- Set `API_BASE_URL` in your Expo `app.config.js`/`app.json` `extra` fields, or provide it directly as a prop to the component.

Example `app.json` extra:
```json
{
  "expo": {
    "extra": {
      "API_BASE_URL": "https://your.server.com"
    }
  }
}
```

Component: `KnnRecsScreen.js`

```jsx
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Button, ActivityIndicator, FlatList, StyleSheet } from 'react-native';
import * as Location from 'expo-location';
import Constants from 'expo-constants';

// Default ML server base. The ML endpoint used by Rentify is:
// https://ml-rentify.onrender.com/ml
const API_BASE = Constants.expoConfig?.extra?.API_BASE_URL || 'https://ml-rentify.onrender.com';

async function callKnn(apiBase, { price, latitude, longitude, k = 5, timeout = 10000 }) {
  const url = `${apiBase.replace(/\/$/, '')}/ml`;
  const payload = { mode: 'knn', price, latitude, longitude, k };

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(id);
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data?.error || `HTTP ${res.status}`);
    }

    // server may return properties (empty list) for empty dataset
    if (Array.isArray(data.properties)) {
      return { recommendations: data.properties, meta: { n_properties: data.n_properties } };
    }

    return { recommendations: data.recommendations || [], meta: data };
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('Request timed out');
    throw err;
  }
}

export default function KnnRecsScreen({ apiBase = API_BASE }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [recs, setRecs] = useState([]);
  const [location, setLocation] = useState(null);

  const getLocation = useCallback(async () => {
    setError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') throw new Error('Location permission denied');
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
      setLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      return pos.coords;
    } catch (e) {
      setError(e.message);
      throw e;
    }
  }, []);

  const fetchRecs = useCallback(async (price = 3500, k = 5) => {
    setLoading(true);
    setError(null);
    try {
      let coords = location;
      if (!coords) {
        const pos = await getLocation();
        coords = { latitude: pos.latitude, longitude: pos.longitude };
      }

      const result = await callKnn(apiBase, { price, latitude: coords.latitude, longitude: coords.longitude, k });
      setRecs(result.recommendations || []);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [apiBase, getLocation, location]);

  useEffect(() => {
    // Optional: fetch on mount with default price
    fetchRecs().catch(() => {});
  }, [fetchRecs]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Rentify Recommendations</Text>
      {loading && <ActivityIndicator size="large" />}
      {error && <Text style={styles.error}>{error}</Text>}

      {!loading && !error && recs.length === 0 && (
        <Text style={styles.empty}>No recommendations available</Text>
      )}

      <FlatList
        data={recs}
        keyExtractor={(item, idx) => item._id?.toString?.() || `${idx}`}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.price}>₱{item.price}</Text>
            <Text style={styles.addr}>{item.address || `${item.latitude}, ${item.longitude}`}</Text>
            {item.score != null && <Text style={styles.score}>Confidence: {(item.score * 100).toFixed(0)}%</Text>}
          </View>
        )}
      />

      <View style={styles.controls}>
        <Button title="Refresh" onPress={() => fetchRecs().catch(() => {})} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  title: { fontSize: 20, fontWeight: '600', marginBottom: 12 },
  error: { color: 'red', marginBottom: 12 },
  empty: { color: '#666', marginBottom: 12 },
  card: { padding: 12, borderBottomWidth: 1, borderColor: '#eee' },
  price: { fontSize: 18, fontWeight: '700' },
  addr: { color: '#444' },
  score: { color: '#0066cc' },
  controls: { marginTop: 12 }
});
```

Notes
- The component uses device GPS; on simulators you may need to set a simulated location or pass `apiBase` with explicit `latitude` and `longitude` for testing.
- The server returns `properties` list entries that may include `address`, `price`, `latitude`, `longitude`, and optional `score`/`confidence` depending on server-side enrichment.
- Secure your API: add an Authorization header for production and validate tokens server-side.

Optional: TypeScript types

```ts
// types.ts
export interface Recommendation {
  _id?: string | number;
  price: number;
  latitude: number;
  longitude: number;
  address?: string;
  score?: number; // 0..1
}
```

Troubleshooting
- If you see 503 responses, call `/ready` to check readiness; server may be starting or DB disconnected.
- If you see HTML errors, ensure `Content-Type: application/json` header is present and server's error handlers are returning JSON (the server in this repo does).

---

If you'd like, I can also:
- Add a TypeScript React component variant.
- Wire this component into a small demo app screen and provide Expo snack link.

Which would you like next?

**Suggest Button (quick integration)**

If you want a quick "Suggest" button on a property card / details screen that asks the ML server for recommended properties near that property, add a button that calls `callKnn` with the property's price and coordinates and then navigates to the `KnnRecsScreen` (or displays results inline).

Example (React Native, inside a property details component):

```jsx
import React from 'react';
import { TouchableOpacity, Text, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import KnnRecsScreen from './KnnRecsScreen'; // or navigate to it
import Constants from 'expo-constants';

const API_BASE = Constants.expoConfig?.extra?.API_BASE_URL || 'https://ml-rentify.onrender.com';

export default function SuggestButton({ property }) {
  const router = useRouter();

  const handleSuggest = async () => {
    try {
      // Option A: prefetch and navigate with results
      const res = await fetch(`${API_BASE.replace(/\/$/, '')}/ml`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'knn', price: property.price, latitude: property.latitude, longitude: property.longitude, k: 8 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);

      // Navigate to recommendations screen and pass results
      router.push({ pathname: '/KnnRecsScreen', params: { recommendations: JSON.stringify(data.recommendations || data.properties || []) } });
    } catch (err) {
      Alert.alert('Suggestion Error', err.message || String(err));
    }
  };

  return (
    <TouchableOpacity onPress={handleSuggest} style={{ padding: 10, backgroundColor: '#6C5CE7', borderRadius: 8 }}>
      <Text style={{ color: '#fff', fontWeight: '600' }}>Suggest</Text>
    </TouchableOpacity>
  );
}
```

Notes:
- This example POSTs to `https://ml-rentify.onrender.com/ml` and expects the same JSON shapes as the `KnnRecsScreen`'s `callKnn` helper.
- You can either navigate to a dedicated recommendations screen (passing results in params) or open a modal / inline list with the returned items.

If you want, I can also add a small `KnnRecsScreen` navigation handler that accepts `recommendations` in `params` and renders them (instead of refetching).