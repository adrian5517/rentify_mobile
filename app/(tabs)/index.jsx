import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Image, TextInput,
  TouchableOpacity, Modal, StatusBar, Dimensions, Alert, Pressable
} from 'react-native';
import { useAuthStore } from '../../store/authStore';
import { Ionicons } from '@expo/vector-icons';
import COLORS from '../../constant/colors';
import Fuse from 'fuse.js';
import MapView, { Marker } from 'react-native-maps';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FlatList, PanResponder, Animated } from 'react-native';
import { ActivityIndicator } from 'react-native';
import propertyService from '../../services/propertyService';
import normalizeAvatar from '../../utils/normalizeAvatar';
import { API_URL as BASE_API_URL } from '../../constant/api';
import mlCache from '../../services/mlCache';

export default function Home() {
  // For slide down to close
  const slideAnim = React.useRef(new Animated.Value(0)).current;
  const panResponder = React.useRef(
    PanResponder.create({
      // Do not capture start touches so children (buttons) can receive presses.
      onStartShouldSetPanResponder: (evt, gestureState) => false,
      onStartShouldSetPanResponderCapture: (evt, gestureState) => false,
      onMoveShouldSetPanResponder: (evt, gestureState) => Math.abs(gestureState.dy) > 10,
      onMoveShouldSetPanResponderCapture: (evt, gestureState) => false,
      onPanResponderMove: (evt, gestureState) => {
        if (gestureState.dy > 0) {
          slideAnim.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (gestureState.dy > 100) {
          handleCloseModal();
          Animated.timing(slideAnim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }).start();
        } else {
          Animated.spring(slideAnim, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  // Allow runtime toggle of panHandlers to debug touch interception
  const [panEnabled, setPanEnabled] = useState(true);

  const user = useAuthStore(state => state.user);
  // Ensure Dicebear SVG URLs are converted to PNG for React Native compatibility
let profilePicture = user?.profilePicture || 'https://example.com/default-profile.png';
if (profilePicture.includes('api.dicebear.com') && profilePicture.includes('/svg?')) {
  profilePicture = profilePicture.replace('/svg?', '/png?');
}
  const username = user?.username || 'Guest';
  const [searchQuery, setSearchQuery] = useState('');
  const [properties, setProperties] = useState([]);
  const [filteredProperties, setFilteredProperties] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [mlRecommended, setMlRecommended] = useState([]);
  const [showML, setShowML] = useState(false);
  const [selectedPropertyRecs, setSelectedPropertyRecs] = useState([]);
  const [selectedPropertyRecsLoading, setSelectedPropertyRecsLoading] = useState(false);
  const [selectedPropertyRecsError, setSelectedPropertyRecsError] = useState(null);
  const [selectedPropertyShowedOnce, setSelectedPropertyShowedOnce] = useState(false);
  const [viewMode, setViewMode] = useState('All'); // 'All' | 'Nearby' | 'Deals'
  const [nearbyProperties, setNearbyProperties] = useState([]);
  const [dealsProperties, setDealsProperties] = useState([]);
  const LOC_PERM_KEY = '@rentify:location_permission';
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const navigation = useNavigation();
  const router = useRouter();
  const params = useLocalSearchParams();
  // Always use KNN for recommendations
  const algo = 'knn';
  const [loadingML, setLoadingML] = useState(false);
  // Optional: force Nearby to always center on this coordinate (for testing)
  // Set to null to use actual device location / ML
  const FORCE_CENTER = null; // { latitude: 13.6335281, longitude: 123.1891166, zoom: 17 };
  // Helper: ensure recommended items have coords and at least one image
  const sanitizeHasCoordsAndImage = (it) => {
    const lat = Number(it.location?.latitude || it.latitude || 0);
    const lon = Number(it.location?.longitude || it.longitude || 0);
    const hasCoords = Number.isFinite(lat) && Number.isFinite(lon) && (lat !== 0 || lon !== 0);
    const hasImage = Array.isArray(it.images) ? it.images.length > 0 && !!it.images[0] : !!(it.image || it.photo);
    return hasCoords && hasImage;
  };
  const [autoLoadedNearby, setAutoLoadedNearby] = useState(false);
  

  const categories = ['All', 'Apartment', 'Boarding House', 'House', 'Dorm'];

  const fuseOptions = {
    keys: ['name', 'description', 'location.address', 'postedBy', 'amenities'],
    threshold: 0.3,
  };

  const fetchProperties = async () => {
    try {
      console.log('🔄 Fetching properties from API...');
      const result = await propertyService.getAllProperties({ forceRefresh: true });
      console.log('📦 API Response:', result);
      
      // Handle the response object structure
      let propertiesArray = [];
      
      if (result.success && Array.isArray(result.properties)) {
        propertiesArray = result.properties;
      } else if (Array.isArray(result.properties)) {
        propertiesArray = result.properties;
      } else if (Array.isArray(result)) {
        propertiesArray = result;
      }
      
      console.log('✅ Fetched properties:', propertiesArray.length);
      
      if (propertiesArray.length > 0) {
        setProperties(propertiesArray);
        // Precompute deals (cheapest properties) for "Deals" view
        try {
          const sortedByPrice = [...propertiesArray].filter(p => typeof p.price === 'number' || !isNaN(Number(p.price))).sort((a,b) => (Number(a.price)||0) - (Number(b.price)||0));
          setDealsProperties(sortedByPrice.slice(0, 20));
        } catch (err) {
          console.warn('Failed to compute dealsProperties', err);
        }
        setFilteredProperties(propertiesArray);
        console.log('📦 Sample property:', JSON.stringify(propertiesArray[0]).substring(0, 200));
      } else {
        console.log('⚠️ No properties returned from API - showing empty state');
        setProperties([]);
        setFilteredProperties([]);
      }
    } catch (error) {
      console.error('❌ Error fetching properties:', error);
      // Show user-friendly error
      alert('Unable to load properties. Please check your internet connection and try again.');
      setProperties([]);
      setFilteredProperties([]);
    }
  };

  const fetchMLRecommendations = async () => {
    setLoadingML(true);
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      setLoadingML(false);
      return alert('Permission denied');
    }
    let location = await Location.getCurrentPositionAsync({});
    
    let price = minPrice ? parseInt(minPrice) : (maxPrice ? parseInt(maxPrice) : 1000);
    const res = await fetch('https://ml-rentify.onrender.com/ml', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: algo, price, ...location.coords }),
    });
    const data = await res.json();
    if (Array.isArray(data)) {
      // Ensure we have the complete property data with images
      const mlWithFullData = data.map(mlItem => {
        const fullProperty = properties.find(p => p._id === mlItem._id);
        if (fullProperty) {
          return {
            ...fullProperty,
            images: fullProperty.images || [],
            location: fullProperty.location || mlItem.location
          };
        }
        return {
          ...mlItem,
          images: mlItem.images || [],
          location: mlItem.location || {}
        };
      });
      setMlRecommended(mlWithFullData);
      setShowML(true);
    }
    setLoadingML(false);
  };
  // Helper: Haversine distance in km
  const haversineDistance = (lat1, lon1, lat2, lon2) => {
    const toRad = (v) => v * Math.PI / 180;
    const R = 6371; // km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // Local KNN: simple distance + price scorer used as fallback/supplement
  const localKnnRecommend = async ({ latitude, longitude, price = 1000, k = 8, weightDistance = 0.75, weightPrice = 0.25 }) => {
    let localProps = Array.isArray(properties) ? properties : [];
    if (!localProps || localProps.length === 0) {
      try {
        const pRes = await propertyService.getAllProperties({ forceRefresh: true });
        if (pRes && Array.isArray(pRes.properties)) {
          localProps = pRes.properties;
          setProperties(localProps);
        }
      } catch (err) {
        console.warn('localKnnRecommend: failed to fetch properties', err);
        return [];
      }
    }

    const scored = localProps.map(p => {
      const plat = Number(p.location?.latitude || p.latitude || 0);
      const plon = Number(p.location?.longitude || p.longitude || 0);
      const distKm = haversineDistance(latitude, longitude, plat, plon);
      const priceDiff = Math.abs((Number(p.price) || 0) - (Number(price) || 0));
      const priceScore = priceDiff / 1000.0; // scale
      const score = (weightDistance * distKm) + (weightPrice * priceScore);
      return { ...p, _score: score, _distanceKm: distKm };
    });

    scored.sort((a,b) => a._score - b._score);

    let results = scored.filter(it => sanitizeHasCoordsAndImage(it)).slice(0, k);
    if (results.length < k) {
      results = scored.filter(it => {
        const lat = Number(it.location?.latitude || it.latitude || 0);
        const lon = Number(it.location?.longitude || it.longitude || 0);
        return Number.isFinite(lat) && Number.isFinite(lon) && (lat !== 0 || lon !== 0);
      }).slice(0, k);
    }

    try {
      const cacheKey = `home_${latitude.toFixed(3)}_${longitude.toFixed(3)}_${price}_${k}`;
      await mlCache.save(cacheKey, results);
    } catch (err) {
      console.warn('localKnnRecommend: cache save failed', err);
    }

    return results;
  };

  const computeNearbyFromDevice = async (k = 8) => {
    try {
      // assume permission already handled by ensureLocationPermission; still request to get fresh status
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location permission is required to get nearby suggestions.');
        return [];
      }
      const loc = await Location.getCurrentPositionAsync({});
      const latitude = loc.coords.latitude;
      const longitude = loc.coords.longitude;

      // Use cached ML results when possible. Key by rounded coords + price + k
      const price = minPrice ? parseInt(minPrice) : (maxPrice ? parseInt(maxPrice) : 1000);
      const key = `home_${latitude.toFixed(3)}_${longitude.toFixed(3)}_${price}_${k}`;
      if (__DEV__) console.log('[ML DEBUG] computeNearbyFromDevice - local properties count', { count: Array.isArray(properties) ? properties.length : 0 });
      // Prepare a local properties list to use for mapping/fallbacks. If empty, try to fetch now.
      let localProps = Array.isArray(properties) ? properties : [];
      if ((!localProps || localProps.length === 0)) {
        try {
          if (__DEV__) console.log('[ML DEBUG] computeNearbyFromDevice - properties empty, fetching from service');
          const pRes = await propertyService.getAllProperties({ forceRefresh: true });
          if (pRes && Array.isArray(pRes.properties) && pRes.properties.length > 0) {
            localProps = pRes.properties;
            setProperties(pRes.properties);
            if (__DEV__) console.log('[ML DEBUG] computeNearbyFromDevice - fetched properties count', { fetched: localProps.length });
          } else {
            if (__DEV__) console.log('[ML DEBUG] computeNearbyFromDevice - fetch returned no properties', { pRes });
          }
        } catch (err) {
          console.warn('computeNearbyFromDevice: failed to fetch properties', err);
        }
      }
      // If FORCE_CENTER is set, short-circuit and return nearest properties to that center
      if (FORCE_CENTER && FORCE_CENTER.latitude && FORCE_CENTER.longitude) {
        if (__DEV__) console.log('[ML DEBUG] computeNearbyFromDevice - FORCE_CENTER active, computing nearest for center', FORCE_CENTER);
        const centerLat = Number(FORCE_CENTER.latitude);
        const centerLon = Number(FORCE_CENTER.longitude);
        const sanitizeHasCoordsAndImage = (it) => {
          const lat = Number(it.location?.latitude || it.latitude || 0);
          const lon = Number(it.location?.longitude || it.longitude || 0);
          const hasCoords = Number.isFinite(lat) && Number.isFinite(lon) && (lat !== 0 || lon !== 0);
          const hasImage = Array.isArray(it.images) ? it.images.length > 0 && !!it.images[0] : !!(it.image || it.photo);
          return hasCoords && hasImage;
        };
        const withDistance = (Array.isArray(localProps) ? localProps : []).map(p => {
          const plat = Number(p.location?.latitude || p.latitude || 0);
          const plon = Number(p.location?.longitude || p.longitude || 0);
          return { ...p, _distanceKm: haversineDistance(centerLat, centerLon, plat, plon) };
        }).filter(p => !isNaN(p._distanceKm));
        withDistance.sort((a,b) => a._distanceKm - b._distanceKm);
        let final = withDistance.filter(sanitizeHasCoordsAndImage).slice(0, k);
        if (final.length < k) {
          // relax image requirement if not enough
          final = withDistance.slice(0, k);
        }
        if (__DEV__) console.log('[ML DEBUG] computeNearbyFromDevice - FORCE_CENTER results', { found: final.length });
        return final;
      }
      try {
        const cached = await mlCache.get(key);
        const stale = await mlCache.isStale(key, 10);
        if (cached && Array.isArray(cached.data) && !stale) {
          // Sanity-check cached results: ensure they are actually near current coords
          try {
            const items = cached.data;
            // helper to extract id string from various _id shapes
            const extractId = (val) => {
              if (!val) return '';
              if (typeof val === 'string') return val;
              if (typeof val === 'object') {
                if (val._id) return extractId(val._id);
                if (val.$oid) return String(val.$oid);
                if (val.id) return extractId(val.id);
                // fallback to JSON short representation
                try { return String(val); } catch (e) { return JSON.stringify(val); }
              }
              return String(val);
            };

            const sampleIds = items.map(i => extractId(i && (i._id || i.id || (i.mlMeta && (i.mlMeta._id || i.mlMeta.id)) || i))).slice(0,5);

            // Map cached items back to local properties when possible (in case ids were saved as strings or partial objects)
            const normalized = items.map(it => {
              const cid = extractId(it._id || it.id || (it.mlMeta && (it.mlMeta._id || it.mlMeta.id)) || it);
              const match = (Array.isArray(localProps) ? localProps : []).find(p => String(p._id) === cid || String(p.id) === cid || extractId(p._id) === cid);
              if (match) return { ...match, mlMeta: it.mlMeta || it };
              // ensure minimal shape
              return {
                _id: cid || (it._id || it.id || ''),
                id: cid || (it.id || it._id || ''),
                name: (it && it.name) || (it && it.title) || 'Recommended Property',
                images: (it && it.images) || [],
                location: (it && it.location) || { latitude: it.latitude || 0, longitude: it.longitude || 0 },
                mlMeta: it.mlMeta || it,
              };
            });

            const distances = normalized.map(i => {
              const lat = Number(i.location?.latitude || i.latitude || 0);
              const lon = Number(i.location?.longitude || i.longitude || 0);
              if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
              return haversineDistance(latitude, longitude, lat, lon);
            }).filter(d => d !== null);
            const avgDistance = distances.length ? distances.reduce((a,b) => a + b, 0) / distances.length : null;
            const within5Km = distances.filter(d => d <= 5).length;
            if (__DEV__) console.log('[ML DEBUG] computeNearbyFromDevice - cache HIT details', { key, cachedCount: items.length, sampleIds, avgDistanceKm: avgDistance, within5Km });
            // If none are within 5km and average distance is large, consider cache invalid for this location
            if (within5Km < 1 && (avgDistance === null || avgDistance > 20)) {
              if (__DEV__) console.log('[ML DEBUG] computeNearbyFromDevice - cache considered location-mismatch, falling through to ML fetch');
            } else {
              return normalized;
            }
          } catch (err) {
            if (__DEV__) console.warn('Error validating cached ML results', err);
            return cached.data;
          }
        }
        if (__DEV__) console.log('[ML DEBUG] computeNearbyFromDevice - cache MISS or stale', { key, hasCached: !!cached, stale });
      } catch (err) {
        console.warn('mlCache read failed for home key', err);
      }

      // Call ML endpoint
      const res = await fetch('https://ml-rentify.onrender.com/ml', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: algo, price, latitude, longitude, k }),
      });
      const data = await res.json();
      const recs = Array.isArray(data.recommendations) ? data.recommendations : (Array.isArray(data.properties) ? data.properties : []);
      if (__DEV__) console.log('[ML DEBUG] computeNearbyFromDevice - ML response', { url: 'https://ml-rentify.onrender.com/ml', price, latitude, longitude, k, raw: data, recsCount: recs.length });

      // Normalize ML items: mlItem can be an object or a plain id string
      let mapped = recs.map(mlItemRaw => {
        const mlId = (mlItemRaw && (mlItemRaw._id || mlItemRaw.id)) ? String(mlItemRaw._id || mlItemRaw.id) : String(mlItemRaw || '');
        const mlMeta = (typeof mlItemRaw === 'object') ? mlItemRaw : { _id: mlId };
        const fullProperty = (Array.isArray(localProps) ? localProps : []).find(p => String(p._id) === mlId || String(p.id) === mlId);
        if (fullProperty) return { ...fullProperty, mlMeta };
        // construct a minimal property object from ML response when local data is missing
        return {
          _id: mlId,
          id: mlId,
          name: mlMeta.name || mlMeta.title || 'Recommended Property',
          images: mlMeta.images || [],
          price: mlMeta.price || 0,
          location: mlMeta.location || { latitude: mlMeta.latitude || 0, longitude: mlMeta.longitude || 0, address: mlMeta.address || '' },
          mlMeta,
        };
      });

      if (__DEV__) console.log('[ML DEBUG] computeNearbyFromDevice - mapped results', { mappedCount: mapped.length, mappedIds: mapped.map(m => m._id || m.id) });

      try { await mlCache.save(key, mapped); } catch (err) { console.warn('mlCache.save failed', err); }
      if (__DEV__) console.log('[ML DEBUG] computeNearbyFromDevice - saved to cache', { key, savedCount: mapped.length });
      if (!mapped || mapped.length === 0) {
        if (__DEV__) console.log('[ML DEBUG] computeNearbyFromDevice - ML returned no results, falling back to distance-based', { propertiesCount: Array.isArray(localProps) ? localProps.length : 0 });
        // Fallback to distance-based ordering if ML didn't return results
        const withDistance = (Array.isArray(localProps) ? localProps : []).map(p => {
          const plat = Number(p.location?.latitude || p.latitude || 0);
          const plon = Number(p.location?.longitude || p.longitude || 0);
          return { ...p, _distanceKm: haversineDistance(latitude, longitude, plat, plon) };
        }).filter(p => !isNaN(p._distanceKm));
        withDistance.sort((a,b) => a._distanceKm - b._distanceKm);
        return withDistance.slice(0, k);
      }
      // If ML returned fewer than requested, supplement with nearest properties
      if (mapped.length < k) {
        if (__DEV__) console.log('[ML DEBUG] computeNearbyFromDevice - supplementing mapped results', { have: mapped.length, want: k });
        const existingIds = new Set(mapped.map(m => String(m._id || m.id)));
        const withDistance = (Array.isArray(localProps) ? localProps : []).map(p => {
          const plat = Number(p.location?.latitude || p.latitude || 0);
          const plon = Number(p.location?.longitude || p.longitude || 0);
          return { ...p, _distanceKm: haversineDistance(latitude, longitude, plat, plon) };
        }).filter(p => !isNaN(p._distanceKm) && !existingIds.has(String(p._id || p.id)));
        withDistance.sort((a,b) => a._distanceKm - b._distanceKm);
        const needed = k - mapped.length;
        const supplement = withDistance.slice(0, needed);
        mapped = [...mapped, ...supplement];
        if (__DEV__) console.log('[ML DEBUG] computeNearbyFromDevice - after supplement', { mappedCount: mapped.length, supplementCount: supplement.length });
      }
      // Sanity filter: ensure recommended items have coords and at least one image
      const sanitizeHasCoordsAndImage = (it) => {
        const lat = Number(it.location?.latitude || it.latitude || 0);
        const lon = Number(it.location?.longitude || it.longitude || 0);
        const hasCoords = Number.isFinite(lat) && Number.isFinite(lon) && (lat !== 0 || lon !== 0);
        const hasImage = Array.isArray(it.images) ? it.images.length > 0 && !!it.images[0] : !!(it.image || it.photo);
        return hasCoords && hasImage;
      };

      let finalList = mapped.filter(sanitizeHasCoordsAndImage);
      if (finalList.length < k) {
        // try to supplement from nearest properties (that also pass sanity)
        const existingIds = new Set(finalList.map(m => String(m._id || m.id)));
        const withDistanceAll = (Array.isArray(localProps) ? localProps : []).map(p => {
          const plat = Number(p.location?.latitude || p.latitude || 0);
          const plon = Number(p.location?.longitude || p.longitude || 0);
          return { ...p, _distanceKm: haversineDistance(latitude, longitude, plat, plon) };
        }).filter(p => !isNaN(p._distanceKm) && !existingIds.has(String(p._id || p.id))).sort((a,b) => a._distanceKm - b._distanceKm);
        const needed = k - finalList.length;
        const supplement = withDistanceAll.filter(sanitizeHasCoordsAndImage).slice(0, needed);
        finalList = [...finalList, ...supplement];
        if (__DEV__) console.log('[ML DEBUG] computeNearbyFromDevice - final after sanity supplement', { finalCount: finalList.length, supplementCount: supplement.length });
      }

      return finalList.slice(0, k);
    } catch (err) {
      console.error('computeNearbyFromDevice error', err);
      return [];
    }
  };

  // Ensure we only ask for location permission once and persist the result
  const ensureLocationPermission = async (promptIfNeeded = true) => {
    try {
      // First check stored flag
      const stored = await AsyncStorage.getItem(LOC_PERM_KEY);
      if (stored === 'granted') return true;

      // Ask the OS for current permission status
      const current = await Location.getForegroundPermissionsAsync();
      if (current && current.status === 'granted') {
        await AsyncStorage.setItem(LOC_PERM_KEY, 'granted');
        return true;
      }

      if (!promptIfNeeded) return false;

      // Request permission once
      const res = await Location.requestForegroundPermissionsAsync();
      if (res && res.status === 'granted') {
        await AsyncStorage.setItem(LOC_PERM_KEY, 'granted');
        return true;
      }
      await AsyncStorage.setItem(LOC_PERM_KEY, 'denied');
      return false;
    } catch (err) {
      console.warn('ensureLocationPermission error', err);
      return false;
    }
  };

  const computeNearbyFromProperty = (property, k = 8) => {
    // Use ML endpoint for property-based recommendations + cache by property id
    if (!property) return [];
    const pid = String(property._id || property.id || property.name || 'property');
    return (async () => {
      try {
        const cached = await mlCache.get(pid);
        const stale = await mlCache.isStale(pid, 10);
        if (cached && Array.isArray(cached.data) && !stale) {
          if (__DEV__) console.log('[ML DEBUG] computeNearbyFromProperty - cache HIT', { pid, cachedCount: cached.data.length });
          return cached.data.slice(0, k);
        }
        if (__DEV__) console.log('[ML DEBUG] computeNearbyFromProperty - cache MISS or stale', { pid, hasCached: !!cached, stale });
      } catch (err) {
        console.warn('mlCache read error for property', err);
      }
      try {
        // Ensure we have local properties available for mapping/fallback
        let localProps = Array.isArray(properties) ? properties : [];
        if ((!localProps || localProps.length === 0)) {
          try {
            if (__DEV__) console.log('[ML DEBUG] computeNearbyFromProperty - properties empty, fetching from service');
            const pRes = await propertyService.getAllProperties({ forceRefresh: true });
            if (pRes && Array.isArray(pRes.properties) && pRes.properties.length > 0) {
              localProps = pRes.properties;
              setProperties(pRes.properties);
              if (__DEV__) console.log('[ML DEBUG] computeNearbyFromProperty - fetched properties count', { fetched: localProps.length });
            } else {
              if (__DEV__) console.log('[ML DEBUG] computeNearbyFromProperty - fetch returned no properties', { pRes });
            }
          } catch (err) {
            console.warn('computeNearbyFromProperty: failed to fetch properties', err);
          }
        }

        const latitude = property.location?.latitude || property.latitude;
        const longitude = property.location?.longitude || property.longitude;
        const price = property.price || 1000;
        const res = await fetch('https://ml-rentify.onrender.com/ml', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: algo, price, latitude, longitude, k }),
        });
        const data = await res.json();
        const recs = Array.isArray(data.recommendations) ? data.recommendations : (Array.isArray(data.properties) ? data.properties : []);
        if (__DEV__) console.log('[ML DEBUG] computeNearbyFromProperty - ML response', { pid, price, latitude, longitude, k, raw: data, recsCount: recs.length });
        // Normalize ML items: handle plain ids and partial objects
        let mapped = recs.map(mlItemRaw => {
          const mlId = (mlItemRaw && (mlItemRaw._id || mlItemRaw.id)) ? String(mlItemRaw._id || mlItemRaw.id) : String(mlItemRaw || '');
          const mlMeta = (typeof mlItemRaw === 'object') ? mlItemRaw : { _id: mlId };
          const fullProperty = (Array.isArray(localProps) ? localProps : []).find(p => String(p._id) === mlId || String(p.id) === mlId);
          if (fullProperty) return { ...fullProperty, mlMeta };
          return {
            _id: mlId,
            id: mlId,
            name: mlMeta.name || mlMeta.title || 'Recommended Property',
            images: mlMeta.images || [],
            price: mlMeta.price || 0,
            location: mlMeta.location || { latitude: mlMeta.latitude || 0, longitude: mlMeta.longitude || 0, address: mlMeta.address || '' },
            mlMeta,
          };
        });
        try { await mlCache.save(pid, mapped); } catch (err) { console.warn('mlCache.save failed', err); }
        if (__DEV__) console.log('[ML DEBUG] computeNearbyFromProperty - mapped results', { pid, mappedCount: mapped.length, mappedIds: mapped.map(m => m._id || m.id) });
        if (!mapped || mapped.length === 0) {
          if (__DEV__) console.log('[ML DEBUG] computeNearbyFromProperty - ML returned no results, falling back to distance-based', { pid, propertiesCount: Array.isArray(localProps) ? localProps.length : 0 });
          // Fallback to nearest by distance
          const withDistance = (Array.isArray(localProps) ? localProps : []).map(p => {
            const plat = Number(p.location?.latitude || p.latitude || 0);
            const plon = Number(p.location?.longitude || p.longitude || 0);
            return { ...p, _distanceKm: haversineDistance(latitude, longitude, plat, plon) };
          }).filter(p => !isNaN(p._distanceKm) && (String(p._id) !== String(property._id)));
          withDistance.sort((a,b) => a._distanceKm - b._distanceKm);
          return withDistance.slice(0, k);
        }
        // Remove any entry equal to the reference property
        mapped = mapped.filter(m => String(m._id || m.id) !== String(pid));
        if (mapped.length < k) {
          if (__DEV__) console.log('[ML DEBUG] computeNearbyFromProperty - supplementing mapped results', { pid, have: mapped.length, want: k });
          const existingIds = new Set(mapped.map(m => String(m._id || m.id)));
          const withDistance = (Array.isArray(localProps) ? localProps : []).map(p => {
            const plat = Number(p.location?.latitude || p.latitude || 0);
            const plon = Number(p.location?.longitude || p.longitude || 0);
            return { ...p, _distanceKm: haversineDistance(latitude, longitude, plat, plon) };
          }).filter(p => !isNaN(p._distanceKm) && !existingIds.has(String(p._id || p.id)) && String(p._id || p.id) !== pid);
          withDistance.sort((a,b) => a._distanceKm - b._distanceKm);
          const needed = k - mapped.length;
          const supplement = withDistance.slice(0, needed);
          mapped = [...mapped, ...supplement];
          if (__DEV__) console.log('[ML DEBUG] computeNearbyFromProperty - after supplement', { pid, mappedCount: mapped.length, supplementCount: supplement.length });
        }

        // Sanity filter: ensure recommended items have coords and at least one image
        const sanitizeHasCoordsAndImage = (it) => {
          const lat = Number(it.location?.latitude || it.latitude || 0);
          const lon = Number(it.location?.longitude || it.longitude || 0);
          const hasCoords = Number.isFinite(lat) && Number.isFinite(lon) && (lat !== 0 || lon !== 0);
          const hasImage = Array.isArray(it.images) ? it.images.length > 0 && !!it.images[0] : !!(it.image || it.photo);
          return hasCoords && hasImage;
        };

        let finalList = mapped.filter(sanitizeHasCoordsAndImage);
        if (finalList.length < k) {
          const existingIds2 = new Set(finalList.map(m => String(m._id || m.id)));
          const withDistanceAll = (Array.isArray(localProps) ? localProps : []).map(p => {
            const plat = Number(p.location?.latitude || p.latitude || 0);
            const plon = Number(p.location?.longitude || p.longitude || 0);
            return { ...p, _distanceKm: haversineDistance(latitude, longitude, plat, plon) };
          }).filter(p => !isNaN(p._distanceKm) && !existingIds2.has(String(p._id || p.id))).sort((a,b) => a._distanceKm - b._distanceKm);
          const needed2 = k - finalList.length;
          const supplement2 = withDistanceAll.filter(sanitizeHasCoordsAndImage).slice(0, needed2);
          finalList = [...finalList, ...supplement2];
          if (__DEV__) console.log('[ML DEBUG] computeNearbyFromProperty - final after sanity supplement', { pid, finalCount: finalList.length, supplementCount: supplement2.length });
        }

        return finalList.slice(0, k);
      } catch (err) {
        console.error('computeNearbyFromProperty error', err);
        return [];
      }
    })();
  };

  // New: safer home suggest handler — compute nearby results and show in Home
  const handleHomeSuggest = async (k = 8) => {
    setLoadingML(true);
    try {
      const ok = await ensureLocationPermission(true);
      if (!ok) {
        Alert.alert('Permission required', 'Location permission is required to show nearby recommendations.');
        return;
      }

      // Decide center
      let center = null;
      if (FORCE_CENTER && FORCE_CENTER.latitude && FORCE_CENTER.longitude) {
        center = { latitude: Number(FORCE_CENTER.latitude), longitude: Number(FORCE_CENTER.longitude) };
      } else {
        const loc = await Location.getCurrentPositionAsync({});
        center = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      }
      if (__DEV__) console.log('[ML DEBUG] handleHomeSuggest - suggest pressed, center', center, { useForce: !!FORCE_CENTER });

      // First try ML/cache path
      let mlResults = await computeNearbyFromDevice(k);
      if (!Array.isArray(mlResults)) mlResults = [];
      const goodCount = mlResults.filter(sanitizeHasCoordsAndImage).length;
      if (__DEV__) console.log('[ML DEBUG] handleHomeSuggest - mlResults', { total: mlResults.length, goodCount });

      // If ML returned too few or too many invalid items, fall back to local KNN
      let final = mlResults;
      if (mlResults.length < k || goodCount < Math.ceil(k * 0.6)) {
        if (__DEV__) console.log('[ML DEBUG] handleHomeSuggest - ML insufficient, calling localKnnRecommend');
        const price = minPrice ? parseInt(minPrice) : (maxPrice ? parseInt(maxPrice) : 1000);
        const local = await localKnnRecommend({ latitude: center.latitude, longitude: center.longitude, price, k });
        // merge unique
        const existingIds = new Set(final.map(i => String(i._id || i.id)));
        const toAdd = local.filter(l => !existingIds.has(String(l._id || l.id)));
        final = [...final, ...toAdd].slice(0, k);
        if (__DEV__) console.log('[ML DEBUG] handleHomeSuggest - after local supplement', { finalCount: final.length, added: toAdd.length });
      }

      // Ensure final passes sanity; if not, compute strict local fallback
      let finalSanitized = final.filter(sanitizeHasCoordsAndImage);
      if (finalSanitized.length === 0) {
        if (__DEV__) console.log('[ML DEBUG] handleHomeSuggest - final empty after sanitize; using strict localKnnRecommend');
        const price = minPrice ? parseInt(minPrice) : (maxPrice ? parseInt(maxPrice) : 1000);
        finalSanitized = await localKnnRecommend({ latitude: center.latitude, longitude: center.longitude, price, k });
      }

      setNearbyProperties(finalSanitized.slice(0, k));
      setViewMode('Nearby');
      if (__DEV__) console.log('[ML DEBUG] handleHomeSuggest - returning final results', { count: finalSanitized.length });
    } catch (err) {
      console.error('handleHomeSuggest error', err);
      Alert.alert('Error', 'Unable to compute suggestions. Please try again.');
    } finally {
      setLoadingML(false);
    }
  };

  // Fetch recommendations for a specific property and navigate to the results screen
  const fetchRecommendationsForProperty = async (property, k = 8) => {
    if (!property) return;
    setLoadingML(true);
    try {
      // Compute nearby properties from this property using ML and switch to Nearby view
      const nearby = await computeNearbyFromProperty(property, k);
      setNearbyProperties(Array.isArray(nearby) ? nearby : []);
      setViewMode('Nearby');
    } catch (err) {
      console.error('Failed to compute property recommendations:', err);
      alert('Failed to get suggestions. Please try again.');
    } finally {
      setLoadingML(false);
    }
  };

  // Inline fetch: show recommendations inside the property modal (keeps user context)
  const fetchRecommendationsInline = async (property, k = 8) => {
    if (!property) return;
    console.log('fetchRecommendationsInline called for', property?._id || property?.id || property?.name);
    setSelectedPropertyRecsError(null);
    setSelectedPropertyRecsLoading(true);
    const pid = String(property._id || property.id || property.name || 'property');

    // Try read from cache first (10min TTL)
    try {
      const cached = await mlCache.get(pid);
      const stale = await mlCache.isStale(pid, 10);
      if (cached && Array.isArray(cached.data) && !stale) {
        setSelectedPropertyRecs(cached.data);
        setSelectedPropertyRecsLoading(false);
        setSelectedPropertyShowedOnce(true);
        return;
      }
    } catch (err) {
      console.warn('mlCache read error, will fetch:', err);
    }

    try {
      const price = property.price || 1000;
      const latitude = property.location?.latitude || property.latitude;
      const longitude = property.location?.longitude || property.longitude;

      const res = await fetch('https://ml-rentify.onrender.com/ml', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: algo, price, latitude, longitude, k }),
      });
      const data = await res.json();
      const recs = Array.isArray(data.recommendations) ? data.recommendations : (Array.isArray(data.properties) ? data.properties : []);

      const mapped = recs.map(mlItemRaw => {
        const mlId = (mlItemRaw && (mlItemRaw._id || mlItemRaw.id)) ? String(mlItemRaw._id || mlItemRaw.id) : String(mlItemRaw || '');
        const mlMeta = (typeof mlItemRaw === 'object') ? mlItemRaw : { _id: mlId };
        const fullProperty = properties.find(p => String(p._id) === mlId || String(p.id) === mlId);
        if (fullProperty) return { ...fullProperty, mlMeta };
        return {
          _id: mlId,
          id: mlId,
          name: mlMeta.name || mlMeta.title || 'Recommended Property',
          images: mlMeta.images || [],
          price: mlMeta.price || 0,
          location: mlMeta.location || { latitude: mlMeta.latitude || 0, longitude: mlMeta.longitude || 0, address: mlMeta.address || '' },
          mlMeta,
        };
      });

      setSelectedPropertyRecs(mapped);

      // Save to cache for faster reopen
      try {
        await mlCache.save(pid, mapped);
      } catch (err) {
        console.warn('mlCache.save failed', err);
      }
    } catch (err) {
      console.error('Inline recommend error', err);
      setSelectedPropertyRecsError(err?.message || String(err));
    } finally {
      setSelectedPropertyRecsLoading(false);
      setSelectedPropertyShowedOnce(true);
    }
  };

  useFocusEffect(useCallback(() => {
    fetchProperties();
  }, []));

  useEffect(() => {
    // If opened with an `openPropertyId` param (from KnnRecsScreen), open that property's modal
    if (params.openPropertyId && properties && properties.length > 0) {
      const pid = String(params.openPropertyId);
      const found = properties.find(p => String(p._id || p.id || '') === pid || p._id === pid || p.id === pid);
      if (found) {
        // slight delay to allow modal/sheet animations to settle
        setTimeout(() => handlePropertyPress(found), 120);
      }
    }

    // On mount / when properties change: if we already have permission, load nearby automatically once
    (async () => {
      try {
        // Auto-prompt once on first mount if needed
        if (!autoLoadedNearby) {
          const perm = await ensureLocationPermission(true);
          if (perm && properties && properties.length > 0) {
            // Only auto-load if user hasn't already switched view
            if (viewMode === 'All') {
              const nearby = await computeNearbyFromDevice(8);
              if (nearby && nearby.length > 0) {
                setNearbyProperties(nearby);
                setViewMode('Nearby');
              }
            }
          }
          setAutoLoadedNearby(true);
        }
      } catch (err) {
        // ignore
      }
    })();

    let filtered = [...properties];
    if (selectedCategory !== 'All')
      filtered = filtered.filter(p => p.propertyType?.toLowerCase() === selectedCategory.toLowerCase());
    if (searchQuery.trim() !== '') {
      const fuse = new Fuse(filtered, fuseOptions);
      filtered = fuse.search(searchQuery).map(r => r.item);
    }
    if (minPrice) filtered = filtered.filter(p => p.price >= parseInt(minPrice));
    if (maxPrice) filtered = filtered.filter(p => p.price <= parseInt(maxPrice));
    
    // Reset ML recommendations when price filters are cleared
    if (!minPrice && !maxPrice && showML) {
      setShowML(false);
      setMlRecommended([]);
    }
    
    if (showML) {
      const mlOnly = mlRecommended.filter(ml => !filtered.some(p => p._id === ml._id));
      setFilteredProperties([...mlOnly, ...filtered]);
    } else {
      setFilteredProperties(filtered);
    }
  }, [searchQuery, selectedCategory, properties, mlRecommended, showML, minPrice, maxPrice]);

  useEffect(() => {
    const filteredProperties = properties.filter(item => {
      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase();
      return (
        (item.name && item.name.toLowerCase().includes(query)) ||
        (item.location?.address && item.location.address.toLowerCase().includes(query))
      );
    });
    setFilteredProperties(filteredProperties);
  }, [searchQuery, properties]);

  const handlePropertyPress = (property) => {
    setSelectedProperty(property);
    setModalVisible(true);
  };

  const handleCloseModal = () => {
    setModalVisible(false);
    setSelectedProperty(null);
    setCurrentImageIndex(0);
  };

  const getImageUri = (property) => {
    if (!property?.images?.length) return 'https://via.placeholder.com/400x300?text=No+Image';
    const path = property.images[0];
    if (!path) return 'https://via.placeholder.com/400x300?text=No+Image';
    return path.startsWith('http') ? path : `${BASE_API_URL}${path.startsWith('/') ? path : '/' + path}`;
  };

  const renderPropertyCard = ({ item }) => (
    <View style={styles.gridCard}>
      <TouchableOpacity onPress={() => handlePropertyPress(item)}>
        <Image source={{ uri: getImageUri(item) }} style={styles.gridImage} />
      </TouchableOpacity>
      <TouchableOpacity style={styles.saveButton} onPress={() => {/* TODO: Save property */}}>
        <Ionicons name="heart-outline" size={22} color={COLORS.primary} />
      </TouchableOpacity>
      <Text style={styles.gridName} numberOfLines={1}>{item.name}</Text>
      <Text style={styles.gridPrice}>₱{item.price}/month</Text>
      <Text style={styles.gridLocation} numberOfLines={1}>{item.location?.address}</Text>
    </View>
  );

  // Decide which list to show based on viewMode and apply filters (category/search/price) to all views
  const filterList = (list) => {
    if (!Array.isArray(list)) return [];
    let out = [...list];
    if (selectedCategory && selectedCategory !== 'All') {
      out = out.filter(p => (p.propertyType || '').toLowerCase() === selectedCategory.toLowerCase());
    }
    if (searchQuery && searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      out = out.filter(p => (p.name && p.name.toLowerCase().includes(q)) || (p.location?.address && p.location.address.toLowerCase().includes(q)));
    }
    if (minPrice) out = out.filter(p => Number(p.price || 0) >= parseInt(minPrice));
    if (maxPrice) out = out.filter(p => Number(p.price || 0) <= parseInt(maxPrice));
    return out;
  };

  const baseList = viewMode === 'All' ? (showML ? mlRecommended : filteredProperties) : (viewMode === 'Deals' ? dealsProperties : nearbyProperties);

  // Deduplicate items by id to avoid React key collisions
  const uniqueById = (arr) => {
    if (!Array.isArray(arr)) return [];
    const seen = new Set();
    const out = [];
    for (let i = 0; i < arr.length; i++) {
      const it = arr[i];
      const id = String(it?._id || it?.id || `${it?.name || ''}-${it?.location?.address || ''}`);
      if (!seen.has(id)) {
        seen.add(id);
        out.push(it);
      }
    }
    return out;
  };

  const currentViewDataUnique = uniqueById(filterList(baseList));

  return (
    <View style={styles.container}>
      <StatusBar hidden />

      {/* Modern Airbnb-style Header */}
      <View style={styles.airbnbHeader}>
        <View style={styles.headerLeft}>
          <Text style={styles.airbnbTitle}>Rentify</Text>
          <Text style={styles.airbnbSubtitle}>Find your next stay</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('profile')}>
          <Image source={{ uri: profilePicture }} style={styles.profileImageLarge} />
        </TouchableOpacity>
      </View>


      
    
      <View style={styles.searchBarWrapper}>
        <Ionicons name="search" size={22} color={COLORS.primary} style={{ marginHorizontal: 8 }} />
        <TextInput
          style={styles.searchBar}
          placeholder="Where to?"
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#b0b0b0"
          accessibilityLabel="Search properties by location or keyword"
        />
      </View>

      {/* Dev-only floating debug button to test press handlers outside modals */}
      
      <View style={styles.priceFilterRowModern}>
        <View style={styles.priceInputLabelGroup}>
          <Text style={styles.priceInputLabel}>Min</Text>
          <TextInput
            style={styles.priceInputModern}
            placeholder="₱"
            keyboardType="numeric"
            value={minPrice}
            onChangeText={setMinPrice}
            placeholderTextColor="#b0b0b0"
              accessibilityLabel="Minimum price"
            />
          </View>
        <Text style={styles.priceRangeDivider}>–</Text>
        <View style={styles.priceInputLabelGroup}>
          <Text style={styles.priceInputLabel}>Max</Text>
          <TextInput
            style={styles.priceInputModern}
            placeholder="₱"
            keyboardType="numeric"
            value={maxPrice}
            onChangeText={setMaxPrice}
            placeholderTextColor="#b0b0b0"
            accessibilityLabel="Maximum price"
          />
        </View>
        <TouchableOpacity
          style={[styles.recommendButtonModern, loadingML && { opacity: 0.7 }]}
          onPress={() => handleHomeSuggest(8)}
          disabled={loadingML}
          accessibilityLabel="Get AI property recommendations"
          activeOpacity={0.85}
        >
          {loadingML ? (
            <ActivityIndicator size="small" color="#fff" style={{ marginRight: 6 }} />
          ) : (
            <Ionicons name="bulb-outline" size={18} color="#fff" style={{ marginRight: 5 }} />
          )}
          <Text style={styles.recommendButtonTextModern}>
            {loadingML ? 'Loading...' : (showML ? 'Recommended' : 'Suggest')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Category Scroll */}
      <View style={styles.floatingCategoryBarWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.floatingCategoryBar}
          contentContainerStyle={{ alignItems: 'center', paddingHorizontal: 6 }}
        >
          {categories.map(cat => (
            <TouchableOpacity
              key={cat}
              onPress={() => setSelectedCategory(cat)}
              style={[styles.floatingCategoryChip, selectedCategory === cat && styles.floatingCategoryChipActive]}
              accessibilityLabel={`Filter by ${cat}`}
              activeOpacity={0.85}
            >
              <Text style={[styles.floatingCategoryChipText, selectedCategory === cat && styles.floatingCategoryChipTextActive]}>{cat}</Text>
              {selectedCategory === cat && (
                <Animated.View style={styles.floatingCategoryChipUnderline} />
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* View Mode Segment: Nearby / Deals / All */}
      <View style={styles.viewModeSegmentWrapper}>
        <TouchableOpacity style={[styles.viewModeButton, viewMode === 'Nearby' && styles.viewModeButtonActive]} onPress={() => setViewMode('Nearby')}>
          <Text style={[styles.viewModeText, viewMode === 'Nearby' && styles.viewModeTextActive]}>Nearby</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.viewModeButton, viewMode === 'Deals' && styles.viewModeButtonActive]} onPress={() => setViewMode('Deals')}>
          <Text style={[styles.viewModeText, viewMode === 'Deals' && styles.viewModeTextActive]}>Great value deals</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.viewModeButton, viewMode === 'All' && styles.viewModeButtonActive]} onPress={() => setViewMode('All')}>
          <Text style={[styles.viewModeText, viewMode === 'All' && styles.viewModeTextActive]}>All</Text>
        </TouchableOpacity>
      </View>

      
      <FlatList
        data={currentViewDataUnique}
        keyExtractor={(item, index) => {
          // Prefer _id, then id, then fallback to name+index
          const key = (item && (item._id || item.id)) ? String(item._id || item.id) : `${item?.name || 'item'}-${index}`;
          return key;
        }}
        renderItem={renderPropertyCard}
        numColumns={2}
        columnWrapperStyle={{ justifyContent: 'space-between' }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={() => (
          <View style={{ alignItems: 'center', marginTop: 32 }}>
            <Text style={{ color: COLORS.text, opacity: 0.7, fontSize: 16 }}>
              {searchQuery.trim() ? 'No properties found for your search.' : 'No properties found.'}
            </Text>
          </View>
        )}
        contentContainerStyle={{ paddingBottom: 120 }}
      />

      {/* Property Details Modal (Sheet) */}
      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={handleCloseModal}>
        <View style={styles.modalOverlay}>
          <Animated.View
            style={[styles.sheetModal, { transform: [{ translateY: slideAnim }] }]}
            {...(panEnabled ? panResponder.panHandlers : {})}
          >
            <View style={styles.modalHeader}>
              <View style={styles.modalHandle} />
              <TouchableOpacity 
                onPress={handleCloseModal} 
                style={styles.sheetCloseBtn} 
                accessibilityLabel="Close property details"
              >
                <Ionicons name="close" size={28} color={COLORS.primary} />
              </TouchableOpacity>
            </View>
            {selectedProperty && (
              <ScrollView showsVerticalScrollIndicator={false} style={styles.modalScrollContent}>
                <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
                  {selectedProperty.images?.map((img, i) => (
                    <Image
                      key={img ? `${img}-${i}` : i}
                      source={{ uri: getImageUri({ images: [img] }) }}
                      style={styles.sheetImage}
                    />
                  ))}
                </ScrollView>
                {/* Modern Property Header Card */}
                <View style={styles.propertyHeaderCard}>
                  <View style={styles.propertyTitleRow}>
                    <View style={styles.propertyTitleContainer}>
                      <Text style={styles.modernSheetTitle}>{selectedProperty.name}</Text>
                      <View style={styles.propertyTypeContainer}>
                        <View style={styles.propertyTypeBadge}>
                          <Ionicons name="home" size={14} color={COLORS.primary} />
                          <Text style={styles.propertyTypeText}>{selectedProperty.propertyType || 'Property'}</Text>
                        </View>
                      </View>
                    </View>
                    <TouchableOpacity style={styles.favoriteButton}>
                      <Ionicons name="heart-outline" size={26} color="#EF4444" />
                    </TouchableOpacity>
                  </View>

                  {/* Price and Rating Row */}
                  <View style={styles.priceRatingRow}>
                    <View style={styles.modernPriceContainer}>
                      <Text style={styles.modernSheetPrice}>₱{selectedProperty.price?.toLocaleString()}</Text>
                      <Text style={styles.priceLabel}>/month</Text>
                    </View>
                    <View style={styles.modernRatingBadge}>
                      <Ionicons name="star" size={16} color="#FFD700" />
                      <Text style={styles.ratingValue}>4.9</Text>
                      <Text style={styles.reviewCount}>(124)</Text>
                    </View>
                  </View>

                  {/* Location with Icon */}
                  <View style={styles.modernLocationRow}>
                    <View style={styles.locationIconContainer}>
                      <Ionicons name="location" size={18} color={COLORS.primary} />
                    </View>
                    <Text style={styles.modernSheetLocation}>{selectedProperty.location?.address}</Text>
                  </View>
                </View>

                {/* Suggest moved to home header — property-modal suggest removed to avoid duplicate/blocked handlers */}

                {/* Description Card */}
                <View style={styles.descriptionCard}>
                  <View style={styles.descriptionHeader}>
                    <Ionicons name="document-text" size={20} color={COLORS.primary} />
                    <Text style={styles.descriptionTitle}>About This Property</Text>
                  </View>
                  <Text style={styles.modernSheetDescription}>{selectedProperty.description}</Text>
                </View>
                {selectedProperty.amenities && (
                  <View style={styles.amenitiesContainer}>
                    <Text style={styles.amenitiesTitle}>Amenities:</Text>
                    {selectedProperty.amenities.map((item, index) => (
                      <Text key={item ? `${item}-${index}` : index} style={styles.amenityItem}>• {item}</Text>
                    ))}
                  </View>
                )}
                {/* Modern Contact Container */}
                <View style={styles.modernContactContainer}>
                  {/* Host Information Card */}
                  <View style={styles.hostInfoCard}>
                    <View style={styles.hostHeader}>
                      <View style={styles.hostAvatarContainer}>
                        <View style={styles.hostAvatar}>
                          <Ionicons name="person" size={24} color="#fff" />
                        </View>
                        <View style={styles.onlineBadge} />
                      </View>
                      <View style={styles.hostDetails}>
                          <Text style={styles.hostName}>{
                            typeof selectedProperty.postedBy === 'string'
                              ? selectedProperty.postedBy
                              : (selectedProperty.postedBy?.name || selectedProperty.postedBy?.username || 'Property Owner')
                          }</Text>
                          <Text style={styles.hostTitle}>Verified Host</Text>
                          <View style={styles.hostRating}>
                            <Ionicons name="star" size={14} color="#FFD700" />
                            <Text style={styles.hostRatingText}>4.9 (127 reviews)</Text>
                          </View>
                        </View>
                        <TouchableOpacity
                          style={styles.hostMessageIcon}
                          onPress={() => {
                            try {
                              const postedBy = selectedProperty.postedBy;
                              const otherUserId = postedBy && typeof postedBy === 'object' ? (postedBy._id || postedBy.id) : null;
                              const otherUserName = typeof postedBy === 'string' ? postedBy : (postedBy?.name || postedBy?.username || 'Property Owner');
                              const otherUserAvatar = normalizeAvatar(postedBy?.profilePicture || postedBy?.avatar || postedBy);

                              router.push({
                                pathname: '/ChatScreen',
                                params: {
                                  otherUserId: otherUserId || undefined,
                                  otherUserName: otherUserName,
                                  otherUserAvatar: otherUserAvatar,
                                  propertyId: selectedProperty._id,
                                  propertyName: selectedProperty.name,
                                }
                              });
                            } catch (err) {
                              console.error('Failed to open chat:', err);
                            }
                          }}
                        >
                          <Ionicons name="chatbubble-ellipses" size={20} color={COLORS.primary} />
                        </TouchableOpacity>
                    </View>
                    
                    <View style={styles.hostStatsRow}>
                      <View style={styles.hostStat}>
                        <Text style={styles.hostStatValue}>98%</Text>
                        <Text style={styles.hostStatLabel}>Response Rate</Text>
                      </View>
                      <View style={styles.hostStatDivider} />
                      <View style={styles.hostStat}>
                        <Text style={styles.hostStatValue}>{'< 1hr'}</Text>
                        <Text style={styles.hostStatLabel}>Response Time</Text>
                      </View>
                    </View>
                  </View>

                  {/* Quick Actions removed as requested. Message action moved to host header button. */}

                  {/* Primary actions removed as requested */}
                </View>

                
                <View style={{ borderRadius: 18, overflow: 'hidden', marginTop: 10, marginBottom: 18 }}>
                  <MapView
                    style={{ width: '100%', height: 180 }}
                    initialRegion={{
                      latitude: selectedProperty.location.latitude,
                      longitude: selectedProperty.location.longitude,
                      latitudeDelta: 0.005,
                      longitudeDelta: 0.005,
                    }}
                    scrollEnabled={false}
                    zoomEnabled={false}
                  >
                    <Marker
                      coordinate={{
                        latitude: selectedProperty.location.latitude,
                        longitude: selectedProperty.location.longitude,
                      }}
                      title={selectedProperty.location.address}
                    />
                  </MapView>
                </View>
                <MapView
                  style={styles.sheetMap}
                  initialRegion={{
                    latitude: selectedProperty.location.latitude,
                    longitude: selectedProperty.location.longitude,
                    latitudeDelta: 0.005,
                    longitudeDelta: 0.005,
                  }}
                >
                  <Marker
                    coordinate={{
                      latitude: selectedProperty.location.latitude,
                      longitude: selectedProperty.location.longitude,
                    }}
                    title={selectedProperty.location.address}
                  />
                </MapView>
              </ScrollView>
            )}
          </Animated.View>
        </View>
      </Modal>
      {/* Dev-only floating debug button to test press handlers outside modals */}
      {__DEV__ && (
        <Pressable
          onPress={() => {
            console.log('DEV floating debug button pressed');
            setPanEnabled(prev => {
              const next = !prev;
              try { Alert.alert('DEV', `PanHandlers ${next ? 'ENABLED' : 'DISABLED'}`); } catch (e) {}
              console.log('panEnabled now', next);
              return next;
            });
          }}
          style={styles.devDebugButton}
          accessibilityLabel="Dev debug button"
        >
          <Text style={{ color: '#fff', fontWeight: '700' }}>DBG</Text>
        </Pressable>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f6f6fa', 
  },
  airbnbHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    backgroundColor: COLORS.primary,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    elevation: 6,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 18,
  },
  headerLeft: {
    flexDirection: 'column',
    justifyContent: 'center',
  },
  airbnbTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.white,
    letterSpacing: 1,
  },
  airbnbSubtitle: {
    fontSize: 16,
    color: '#f5f5f5',
    marginTop: 2,
    fontWeight: '500',
  },
  profileImageLarge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#fff',
    backgroundColor: COLORS.secondary,
  },
  searchBarWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 18,
    marginTop: -24,
    backgroundColor: '#fff',
    borderRadius: 16,
    elevation: 3,
    shadowColor: '#222',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    zIndex: 10,
  },
  searchBar: {
    flex: 1,
    height: 44,
    padding: 10,
    fontSize: 17,
    backgroundColor: '#f6f6fa',
    borderRadius: 12,
    marginRight: 10,
    color: COLORS.text,
  },
  filterButton: {
    padding: 10,
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
  },
  // --- MODERN PRICE RANGE & RECOMMEND BUTTON ---
  priceFilterRowModern: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 3,
    backgroundColor: '#f8f9fd',
    borderRadius: 18,
    marginHorizontal: 12,
    marginTop: 10,
    elevation: 2,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.07,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: '#ececec',
    minHeight: 34,
    gap: 5,
  },
  priceInputLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  priceInputLabel: {
    fontSize: 12,
    color: '#888',
    fontWeight: '600',
    marginRight: 3,
    marginLeft: 1,
  },
  priceInputModern: {
    width: 60,
    height: 26,
    paddingHorizontal: 8,
    fontSize: 13,
    backgroundColor: '#fff',
    borderRadius: 13,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    textAlign: 'center',
  },
  priceRangeDivider: {
    fontSize: 18,
    color: '#aaa',
    marginHorizontal: 2,
    fontWeight: 'bold',
    marginBottom: 1,
  },
  recommendButtonModern: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    paddingVertical: 7,
    paddingHorizontal: 14,
    marginLeft: 10,
    elevation: 3,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.13,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    minHeight: 30,
  },
  recommendButtonTextModern: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
    letterSpacing: 0.2,
  },
  recommendButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
  },
  recommendButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
    marginLeft: 6,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  welcomeText: { fontSize: 18, fontWeight: 'bold' },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  profileImage: { width: 32, height: 32, borderRadius: 16, marginLeft: 10 },
  buttonContainer: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 10 },
  button: { backgroundColor: COLORS.primary, flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 10 },
  buttonText: { color: 'white', marginLeft: 6 },
  priceFilterRow: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 10 },
  searchContainer: { flexDirection: 'row', margin: 10 },
  searchInput: { backgroundColor: '#fff', flex: 1, borderRadius: 8, padding: 10, margin: 5 },
  searchButton: { backgroundColor: COLORS.primary, padding: 10, borderRadius: 8, justifyContent: 'center' },
  categoryWrapper: {
    marginVertical: 10,
    paddingHorizontal: 10,
  },
  categoryButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginHorizontal: 6,
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    zIndex: 1,
    padding:20,
    
    borderColor: COLORS.primary,
  },
  categoryButtonActive: {
    backgroundColor: COLORS.primary,
  },
  categoryText: {
    fontSize: 14,
    color: COLORS.primary,
    paddingHorizontal: 10,
  },
  categoryTextActive: {
    fontWeight: 'bold',
    color: COLORS.white,
  },
  filteredDataContainer: { paddingHorizontal: 10 },
  // --- PROPERTY GRID ---
  gridContainer: {
    paddingBottom: 120,
    paddingHorizontal: 10,
  },
  gridRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  gridCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    marginBottom: 18,
    width: '48%',
    shadowColor: COLORS.primary,
    shadowOpacity: 0.09,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 18,
    elevation: 5,
    overflow: 'hidden',
    position: 'relative',
    marginHorizontal: '1%',
  },
  gridImage: {
    width: '100%',
    height: 140,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    resizeMode: 'cover',
    backgroundColor: '#f3f3f3',
  },
  saveButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 7,
    elevation: 3,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.16,
    shadowOffset: { width: 0, height: 2 },
  },
  // Suggestion card styles
  suggestCard: {
    width: 220,
    marginRight: 12,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#fff',
    elevation: 6,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
  },
  suggestImage: { width: 220, height: 130, resizeMode: 'cover', backgroundColor: '#f3f3f3' },
  suggestBody: { padding: 10, backgroundColor: '#fff' },
  suggestPrice: { fontSize: 15, fontWeight: '800', color: COLORS.primary },
  suggestAddr: { color: '#444', marginTop: 4 },
  gridName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 10,
    marginHorizontal: 12,
    color: COLORS.text,
  },
  gridPrice: {
    fontSize: 15,
    color: COLORS.primary,
    fontWeight: 'bold',
    marginTop: 4,
    marginHorizontal: 12,
    backgroundColor: '#f4f4ff',
    alignSelf: 'flex-start',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginBottom: 2,
  },
  gridLocation: {
    fontSize: 13,
    color: '#888',
    marginHorizontal: 12,
    marginBottom: 10,
  },

  // --- CATEGORY CHIPS ---
  categoryWrapper: {
    marginVertical: 16,
    paddingHorizontal: 10,
    flexDirection: 'row',
  },
  categoryButton: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    marginHorizontal: 6,
    backgroundColor: '#f2f2f7',
    borderRadius: 16,
    elevation: 2,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.07,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 4,
    borderWidth: 0,
  },
  categoryButtonActive: {
    backgroundColor: COLORS.primary,
    elevation: 5,
    shadowOpacity: 0.18,
  },
  categoryText: {
    fontSize: 15,
    color: COLORS.primary,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  categoryTextActive: {
    fontWeight: 'bold',
    color: COLORS.white,
    letterSpacing: 0.2,
  },


  // --- MODAL/SHEET ---
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.18)',
    justifyContent: 'flex-end',
  },
  sheetModal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 12,
    height: '90%',
    elevation: 16,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: -2 },
    shadowRadius: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
    position: 'relative',
    paddingTop: 4,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#e0e0e0',
    borderRadius: 2,
    marginBottom: 8,
  },
  sheetCloseBtn: {
    position: 'absolute',
    right: 0,
    top: 8,
    backgroundColor: '#e1e1e1',
    borderRadius: 20,
    padding: 8,
    zIndex: 1,
  },
  modalScrollContent: {
    flex: 1,
    paddingBottom: 20,
  },
  sheetImage: {
    width: Dimensions.get('window').width - 24,
    height: 180,
    borderRadius: 16,
    marginBottom: 8,
    resizeMode: 'cover',
    alignSelf: 'center',
    backgroundColor: '#f3f3f3',
  },
  sheetTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginTop: 10,
    marginBottom: 2,
    color: COLORS.primary,
    textAlign: 'center',
  },
  sheetPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    marginVertical: 4,
    color: '#27ae60',
    textAlign: 'center',
    backgroundColor: '#eaffea',
    alignSelf: 'center',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 2,
  },
  sheetLocation: {
    fontSize: 15,
    color: '#555',
    marginBottom: 6,
    textAlign: 'center',
  },
  sheetDescription: {
    fontSize: 15,
    color: '#333',
    marginBottom: 10,
    textAlign: 'center',
  },

  // --- MODERN PROPERTY HEADER CARD ---
  propertyHeaderCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  propertyTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  propertyTitleContainer: {
    flex: 1,
    marginRight: 12,
  },
  modernSheetTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 6,
    lineHeight: 28,
    letterSpacing: -0.5,
  },
  propertyTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  propertyTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  propertyTypeText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
    marginLeft: 6,
    textTransform: 'capitalize',
  },
  favoriteButton: {
    backgroundColor: '#FEF2F2',
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FEE2E2',
    shadowColor: '#EF4444',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 3,
  },
  priceRatingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  modernPriceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  modernSheetPrice: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: -0.8,
  },
  priceLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 6,
    fontWeight: '500',
  },
  modernRatingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FEF3C7',
    gap: 4,
  },
  ratingValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#92400E',
  },
  reviewCount: {
    fontSize: 12,
    color: '#78716C',
    fontWeight: '500',
  },
  modernLocationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  locationIconContainer: {
    backgroundColor: '#EEF2FF',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  modernSheetLocation: {
    flex: 1,
    fontSize: 15,
    color: '#4B5563',
    lineHeight: 22,
    fontWeight: '500',
  },

  // Description Card
  descriptionCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  descriptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  descriptionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginLeft: 8,
    letterSpacing: -0.2,
  },
  modernSheetDescription: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 21,
    fontWeight: '400',
  },

  sheetActions: {
    marginTop: 16,
    marginBottom: 15,
    flexDirection: 'column',
  },

  // --- MODERN CONTACT CONTAINER ---
  modernContactContainer: {
    marginTop: 12,
    marginBottom: 12,
    gap: 10,
  },
  
  // Host Info Card
  hostInfoCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    shadowColor: '#8B5CF6',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  hostHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  hostAvatarContainer: {
    position: 'relative',
    marginRight: 16,
  },
  hostAvatar: {
    backgroundColor: COLORS.primary,
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 6,
  },
  onlineBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#10B981',
    borderWidth: 3,
    borderColor: '#fff',
  },
  hostDetails: {
    flex: 1,
  },
  hostName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  hostTitle: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 6,
    fontWeight: '500',
  },
  hostRating: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#FEF3C7',
  },
  hostRatingText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400E',
    marginLeft: 4,
  },
  hostMessageIcon: {
    backgroundColor: '#F9FAFB',
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  hostStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  hostStat: {
    alignItems: 'center',
  },
  hostStatValue: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: 4,
  },
  hostStatLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  hostStatDivider: {
    width: 1,
    height: 32,
    backgroundColor: '#E5E7EB',
  },

  // Quick Actions
  quickActionsContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  quickActionsTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 10,
    letterSpacing: -0.2,
  },
  quickActionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  quickActionCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 3,
  },
  quickActionIcon: {
    backgroundColor: '#F9FAFB',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  quickActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },

  // Primary Actions
  primaryActionsContainer: {
    gap: 10,
  },
  modernScheduleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 13,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 3,
    gap: 8,
  },
  modernScheduleButtonText: {
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 0.2,
  },
  modernRentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 13,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 6,
    gap: 8,
  },
  modernRentButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 0.2,
  },

  modalContainer: {
    flex: 1,
    backgroundColor: 'white',
    marginTop: 40,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
  },
  
  modalContent: {
    paddingBottom: 20,
  },
  
  closeButton: {
    alignSelf: 'flex-end',
    marginBottom: 10,
  },
  
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  
  modalPrice: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 8,
    color: COLORS.primary,
  },
  
  modalLocation: {
    fontSize: 16,
    color: '#555',
    marginBottom: 8,
  },
  
  modalDescription: {
    fontSize: 14,
    color: '#333',
    marginBottom: 12,
  },
  
  modalImage: {
    width: Dimensions.get('window').width - 32,
    height: 200,
    borderRadius: 8,
    marginBottom: 12,
    resizeMode: 'cover',
  },
  chipRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginVertical: 8,
  },
  // --- FLOATING CATEGORY BAR ---
  floatingCategoryBarWrapper: {
    marginHorizontal: 12,
    marginTop: 12,
    marginBottom: 2,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.93)',
    elevation: 6,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.10,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 10,
    paddingVertical: 0,
  },
  floatingCategoryBar: {
    borderRadius: 22,
    minHeight: 38,
    maxHeight: 38,
  },
  floatingCategoryChip: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#f4f5fa',
    marginHorizontal: 3,
    elevation: 0,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 28,
    minWidth: 50,
    flexDirection: 'column',
    position: 'relative',
  },
  floatingCategoryChipActive: {
    backgroundColor: COLORS.primary,
    elevation: 2,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.17,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
  },
  floatingCategoryChipText: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '700',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  floatingCategoryChipTextActive: {
    fontWeight: 'bold',
    color: COLORS.white,
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  floatingCategoryChipUnderline: {
    width: 16,
    height: 3,
    borderRadius: 2,
    backgroundColor: COLORS.accent || '#ffd700', // fallback accent
    marginTop: 2,
    alignSelf: 'center',
  },

  viewModeSegmentWrapper: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: 12,
    marginTop: 10,
    marginBottom: 6,
    padding: 6,
    borderRadius: 12,
    backgroundColor: '#fff',
    elevation: 2,
  },
  viewModeButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  viewModeButtonActive: {
    backgroundColor: COLORS.primary,
  },
  viewModeText: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  viewModeTextActive: {
    color: '#fff',
    fontWeight: '700',
  },

  
  
  amenitiesContainer: {
    marginVertical: 8,
  },
  
  amenitiesTitle: {
    fontWeight: 'bold',
    marginBottom: 3,
    fontSize: 15,
  },
  
  amenityItem: {
    fontSize: 14,
    color: '#444',
  },
  closeButton: { alignSelf: 'flex-end', padding: 10 },
  modalImage: { width: Dimensions.get('window').width, height: 200 },

  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20,
  },
  contactButton: {
    backgroundColor: '#3498db',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  contactButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  rentButton: {
    backgroundColor: '#27ae60',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  rentButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  devDebugButton: {
    position: 'absolute',
    top: 18,
    right: 18,
    zIndex: 9999,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    elevation: 10,
  },
});