import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, View, Alert, Text, TouchableOpacity, Image, ScrollView, Animated, Dimensions } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import MapboxDirections from '@mapbox/mapbox-sdk/services/directions';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import COLORS from '../../constant/colors';

// Use require for consistent asset loading

const Person = require('../../assets/images/personView.png');
const House = require('../../assets/images/houseView.png');

const MAPBOX_TOKEN = 'pk.eyJ1IjoiYWRyaWFuNTUxNyIsImEiOiJjbWVoYjVrYzIwNTI3MmpzYzIyYzhpbTlxIn0.33wMUowKG_-xY-qe08KAYQ';
const directionsClient = MapboxDirections({ accessToken: MAPBOX_TOKEN });

const getImageUri = (property) => {
  console.log('Full property object:', property); // Debug log
  console.log('Property images:', property?.images); // Debug log
  
  // Use first image index only, same as List component
  const firstImage = property?.images?.[0];
  console.log('First image:', firstImage); // Debug log
  
  if (!firstImage) {
    console.log('No image found, using placeholder'); // Debug log
    return 'https://via.placeholder.com/400x300?text=No+Image';
  }
  
  // Since images are already full URLs from Cloudinary, return as-is
  console.log('Final image URL:', firstImage); // Debug log
  return firstImage;
};

export default function Maps() {
  const [location, setLocation] = useState(null);
  const [mlProperties, setMlProperties] = useState([]);
  const [routeCoords, setRouteCoords] = useState([]);
  const [distance, setDistance] = useState(null);
  const [duration, setDuration] = useState(null);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [isLocationPermissionGranted, setIsLocationPermissionGranted] = useState(false);
  const [refresh, setRefresh] = useState(false);
  const [selectedCluster, setSelectedCluster] = useState(3); // Default to "All Properties"
  const [loadingML, setLoadingML] = useState(false);
  const mapRef = useRef(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const expandAnim = useRef(new Animated.Value(0)).current;
  const [showFilters, setShowFilters] = useState(false);
  const [navigationMode, setNavigationMode] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [routeSteps, setRouteSteps] = useState([]);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const [showContactModal, setShowContactModal] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showActionsPanel, setShowActionsPanel] = useState(true);
  const contactAnim = useRef(new Animated.Value(0)).current;
  const bookingAnim = useRef(new Animated.Value(0)).current;
  const actionsAnim = useRef(new Animated.Value(1)).current;
  const [realDistance, setRealDistance] = useState(null);
  const [showHostContact, setShowHostContact] = useState(false);
  const hostContactAnim = useRef(new Animated.Value(0)).current;
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const imageViewerAnim = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef(null);

  // Helper to calculate accurate distance between two coordinates using Haversine formula
  function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the Earth in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c; // Distance in kilometers
    return distance;
  }

  // Helper to calculate bearing from user to a property
  function getBearing(lat1, lon1, lat2, lon2) {
    const toRad = deg => deg * Math.PI / 180;
    const toDeg = rad => rad * 180 / Math.PI;
    const dLon = toRad(lon2 - lon1);
    lat1 = toRad(lat1);
    lat2 = toRad(lat2);
    const y = Math.sin(dLon) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
    let brng = Math.atan2(y, x);
    brng = toDeg(brng);
    return (brng + 360) % 360;
  }

  // Center and face map to nearest property after location/properties load
  useEffect(() => {
    if (location && mlProperties.length && mapRef.current) {
      // Only use properties with valid coordinates
      const validProps = mlProperties.filter(p => typeof p.latitude === 'number' && typeof p.longitude === 'number');
      if (!validProps.length) return;
      // Find nearest property
      let nearest = validProps[0];
      let minDist = Number.MAX_VALUE;
      validProps.forEach(p => {
        const d = Math.sqrt(
          Math.pow(p.latitude - location.coords.latitude, 2) +
          Math.pow(p.longitude - location.coords.longitude, 2)
        );
        if (d < minDist) {
          minDist = d;
          nearest = p;
        }
      });
      const heading = getBearing(
        location.coords.latitude,
        location.coords.longitude,
        nearest.latitude,
        nearest.longitude
      );
      mapRef.current.animateCamera({
        center: {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        },
        heading,
        zoom: 15,
        pitch: 0,
      }, { duration: 1200 });
    }
  }, [location, mlProperties]);

  useEffect(() => {
    const requestLocationPermission = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location permission is required');
        return;
      }

      setIsLocationPermissionGranted(true);
      const loc = await Location.getCurrentPositionAsync({});
      setLocation(loc.coords);
    };

    requestLocationPermission();
  }, [refresh]);

  // Fetch clustered properties from ML API using K-means
  useEffect(() => {
    const fetchAndClusterProperties = async () => {
      if (!location) {
        console.log('❌ No location available yet, skipping clustering');
        return;
      }

      setLoadingML(true);
      console.log('🔄 Starting K-means clustering...');

      try {
        // 1. First fetch all properties from backend
        console.log('📡 Fetching properties from backend...');
        const propertiesRes = await fetch('https://rentify-server-ge0f.onrender.com/api/properties');
        
        if (!propertiesRes.ok) {
          throw new Error(`Backend API error: ${propertiesRes.status}`);
        }

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
        
        console.log(`✅ Fetched ${properties.length} properties from backend`);
        console.log('📦 Sample property:', properties[0] ? JSON.stringify(properties[0]).substring(0, 200) : 'none');

        if (!properties || properties.length === 0) {
          console.log('❌ No properties found from backend, using test data');
          // Use test data for development/debugging with correct structure
          const testProperties = [
            {
              _id: 'test1',
              name: 'Affordable Studio Apartment',
              description: 'Cozy studio perfect for students and young professionals',
              price: 3500,
              location: {
                latitude: 13.6218,
                longitude: 123.1948,
                address: 'Budget Area, Naga City'
              },
              images: ['https://via.placeholder.com/400x300?text=Affordable+Studio'],
              propertyType: 'studio',
              amenities: ['WiFi', 'Security'],
              status: 'available',
              postedBy: 'Maria Santos'
            },
            {
              _id: 'test2', 
              name: 'Mid-Range Condo',
              description: 'Comfortable condominium unit with modern amenities',
              price: 5500,
              location: {
                latitude: 13.6230,
                longitude: 123.1960,
                address: 'Mid-Range Area, Naga City'
              },
              images: ['https://via.placeholder.com/400x300?text=Mid-Range+Condo'],
              propertyType: 'condominium',
              amenities: ['WiFi', 'Parking', 'Security'],
              status: 'available',
              postedBy: 'Juan Dela Cruz'
            },
            {
              _id: 'test3',
              name: 'Luxury Penthouse',
              description: 'Premium penthouse with stunning city views',
              price: 15000,
              location: {
                latitude: 13.6240,
                longitude: 123.1970,
                address: 'Premium Area, Naga City'
              },
              images: ['https://via.placeholder.com/400x300?text=Luxury+Penthouse'],
              propertyType: 'penthouse',
              amenities: ['WiFi', 'Parking', 'Security', 'Pool', 'Gym'],
              status: 'available',
              postedBy: 'Pedro Reyes'
            },
            {
              _id: 'test4',
              name: 'Budget Room',
              description: 'Affordable room near universities',
              price: 2500,
              location: {
                latitude: 13.6200,
                longitude: 123.1930,
                address: 'Economic Zone, Naga City'
              },
              images: ['https://via.placeholder.com/400x300?text=Budget+Room'],
              propertyType: 'room',
              amenities: ['WiFi'],
              status: 'available',
              postedBy: 'Ana Garcia'
            },
            {
              _id: 'test5',
              name: 'Modern Apartment',
              description: 'Spacious apartment in prime location',
              price: 8000,
              location: {
                latitude: 13.6250,
                longitude: 123.1980,
                address: 'Modern District, Naga City'
              },
              images: ['https://via.placeholder.com/400x300?text=Modern+Apartment'],
              propertyType: 'apartment',
              amenities: ['WiFi', 'Parking', 'Security', 'Gym'],
              status: 'available',
              postedBy: 'Carlos Lopez'
            }
          ];
          
          // Apply correct price-based clustering to test data: 2k-4k, 4k-7k, 7k+
          const clusteredTestData = testProperties.map(property => ({
            ...property,
            cluster: property.price <= 4000 ? 0 : property.price <= 7000 ? 1 : 2
          }));
          
          console.log('✅ Using test data with price-based clustering');
          console.log(`📊 Test data: ${clusteredTestData.length} properties`);
          setMlProperties(clusteredTestData);
          return;
        }

        // 2. Use fast price-based clustering (skip ML API to avoid delays)
        console.log('🔄 Applying price-based clustering...');
        
        // Price ranges: Low Budget (≤4k), Mid Range (4k-7k), High End (>7k)
        const clusteredProperties = properties.map(property => {
          // Handle both old format (latitude/longitude) and new format (location.latitude/longitude)
          const lat = property.location?.latitude || property.latitude || location.latitude;
          const lng = property.location?.longitude || property.longitude || location.longitude;
          
          // Price-based clustering: 0=Low Budget (≤4k), 1=Mid Range (4k-7k), 2=High End (>7k)
          const cluster = property.price <= 4000 ? 0 : property.price <= 7000 ? 1 : 2;
          
          console.log(`✅ ${property.name}: ₱${property.price} → ${['Low Budget', 'Mid Range', 'High End'][cluster]}`);
          
          // Ensure location object exists
          return {
            ...property,
            cluster,
            location: property.location || {
              latitude: lat,
              longitude: lng,
              address: property.address || property.location?.address || 'Naga City'
            }
          };
        });

        console.log(`✅ Successfully clustered ${clusteredProperties.length} properties`);
        
        // Log cluster distribution for debugging
        const clusterCounts = [0, 1, 2].map(cluster => 
          clusteredProperties.filter(p => p.cluster === cluster).length
        );
        console.log('📊 Cluster distribution:', {
          'Low Budget': clusterCounts[0],
          'Mid Range': clusterCounts[1], 
          'High End': clusterCounts[2],
          'Total': clusteredProperties.length
        });

        // If no properties in any cluster, ensure we have at least some data
        if (clusteredProperties.length === 0) {
          console.log('⚠️ No clustered properties found, creating fallback data');
          // Create some test properties to ensure the app works
          const fallbackData = [
            {
              _id: 'fallback1',
              name: 'Sample Low Budget Property',
              description: 'Affordable property in Naga City',
              price: 3500,
              location: { 
                latitude: 13.6218,
                longitude: 123.1948,
                address: 'Budget Area, Naga City' 
              },
              images: ['https://via.placeholder.com/400x300?text=Low+Budget'],
              propertyType: 'apartment',
              amenities: ['WiFi', 'Security'],
              status: 'available',
              postedBy: 'Property Owner',
              cluster: 0
            },
            {
              _id: 'fallback2',
              name: 'Sample Mid Range Property',
              description: 'Comfortable living space',
              price: 5500,
              location: { 
                latitude: 13.6230,
                longitude: 123.1960,
                address: 'Mid Range Area, Naga City' 
              },
              images: ['https://via.placeholder.com/400x300?text=Mid+Range'],
              propertyType: 'condominium',
              amenities: ['WiFi', 'Parking', 'Security'],
              status: 'available',
              postedBy: 'Property Owner',
              cluster: 1
            },
            {
              _id: 'fallback3',
              name: 'Sample High End Property',
              description: 'Luxury property with premium amenities',
              price: 15000,
              location: { 
                latitude: 13.6240,
                longitude: 123.1970,
                address: 'Premium Area, Naga City' 
              },
              images: ['https://via.placeholder.com/400x300?text=High+End'],
              propertyType: 'penthouse',
              amenities: ['WiFi', 'Parking', 'Security', 'Pool', 'Gym'],
              status: 'available',
              postedBy: 'Property Owner',
              cluster: 2
            }
          ];
          setMlProperties(fallbackData);
        } else {
          setMlProperties(clusteredProperties);
        }

      } catch (error) {
        console.error('❌ Clustering error:', error);
        
        // Enhanced fallback: try to get properties without clustering
        try {
          console.log('🔄 Attempting fallback to properties without clustering...');
          const fallbackRes = await fetch('https://rentify-server-ge0f.onrender.com/api/properties');
          
          if (fallbackRes.ok) {
            const data = await fallbackRes.json();
            
            // Handle different response formats
            let fallbackProperties = [];
            if (Array.isArray(data)) {
              fallbackProperties = data;
            } else if (data.properties && Array.isArray(data.properties)) {
              fallbackProperties = data.properties;
            } else if (data.success && data.properties) {
              fallbackProperties = data.properties;
            }
            
            console.log(`📦 Fallback got ${fallbackProperties.length} properties`);
            
            // Apply correct price-based clustering as fallback
            const clusteredFallback = fallbackProperties.map(property => {
              const lat = property.location?.latitude || property.latitude || 13.6218;
              const lng = property.location?.longitude || property.longitude || 123.1815;
              
              return {
                ...property,
                cluster: property.price <= 4000 ? 0 : property.price <= 7000 ? 1 : 2,
                location: property.location || {
                  latitude: lat,
                  longitude: lng,
                  address: property.address || property.location?.address || 'Naga City'
                }
              };
            });
            
            console.log(`✅ Fallback successful: ${clusteredFallback.length} properties with price-based clustering`);
            setMlProperties(clusteredFallback);
          } else {
            console.log('❌ Fallback failed: Backend unreachable');
            Alert.alert('Connection Error', 'Unable to load properties. Please check your internet connection.');
          }
        } catch (fallbackError) {
          console.error('❌ Fallback error:', fallbackError);
          Alert.alert('Error', 'Failed to load properties');
        }
      } finally {
        setLoadingML(false);
      }
    };

    fetchAndClusterProperties();
  }, [location, refresh]);

  useEffect(() => {
    const fetchDirections = async () => {
      if (selectedProperty && location && selectedProperty.location) {
        try {
          const response = await directionsClient
            .getDirections({
              profile: 'driving',
              geometries: 'geojson',
              waypoints: [
                { coordinates: [location.longitude, location.latitude] },
                { coordinates: [selectedProperty.location.longitude, selectedProperty.location.latitude] },
              ],
            })
            .send();

          const route = response.body.routes[0];
          const coords = route.geometry.coordinates.map(([lon, lat]) => ({
            latitude: lat,
            longitude: lon,
          }));

          setRouteCoords(coords);
          setDistance(route.distance / 1000); // meters to km
          setDuration(route.duration / 60); // seconds to minutes

          mapRef.current?.animateToRegion({
            latitude: selectedProperty.location.latitude,
            longitude: selectedProperty.location.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          });
        } catch (err) {
          console.error('Failed to fetch directions:', err);
        }
      }
    };

    fetchDirections();
  }, [selectedProperty, location, refresh]);

  // Static cluster labels and colors for consistent UI - Added "All Properties" as default
  const staticLabels = ['Low Budget', 'Mid Range', 'High End', 'All Properties'];
  const staticColors = ['#4CAF50', '#FFC107', '#E91E63', '#2563eb'];

  // Direct cluster mapping - no need for dynamic remapping since we assign by price
  // Button index 0 = Low Budget (cluster 0)
  // Button index 1 = Mid Range (cluster 1) 
  // Button index 2 = High End (cluster 2)
  // Button index 3 = All Properties (show all)
  const getClusterMapping = () => {
    // Simple 1:1 mapping - button index matches cluster index
    return [0, 1, 2];
  };

  // Filter properties based on selected cluster
  const filteredProperties = (() => {
    if (!mlProperties.length) {
      // Don't log during initial load - this is expected
      return [];
    }
    
    if (selectedCluster === 3) {
      // Show all properties when "All Properties" is selected
      console.log(`🗺️ Showing all ${mlProperties.length} properties (All Properties mode)`);
      return mlProperties;
    }
    
    // Filter by specific cluster (0=Low Budget, 1=Mid Range, 2=High End)
    const clusterMap = getClusterMapping();
    const targetCluster = clusterMap[selectedCluster];
    const filtered = mlProperties.filter(p => p.cluster === targetCluster);
    
    console.log(`🗺️ Filtering for cluster ${targetCluster} (${staticLabels[selectedCluster]}): ${filtered.length} properties`);
    
    // If no properties in selected cluster, log cluster distribution
    if (filtered.length === 0) {
      console.log('📊 Cluster distribution:');
      [0, 1, 2].forEach(cluster => {
        const count = mlProperties.filter(p => p.cluster === cluster).length;
        console.log(`   - ${staticLabels[cluster]} (${cluster}): ${count} properties`);
      });
    }
    
    return filtered;
  })();

  // Debug logs
  // console.log('mlProperties:', mlProperties);
  // console.log('filteredProperties:', filteredProperties);

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
    Animated.spring(expandAnim, {
      toValue: isExpanded ? 0 : 1,
      useNativeDriver: true,
      tension: 50,
      friction: 7
    }).start();
  };

  // Function to get turn-by-turn directions
  const getTurnByTurnDirections = async (start, end) => {
    try {
      const response = await directionsClient
        .getDirections({
          profile: 'driving',
          geometries: 'geojson',
          steps: true,
          waypoints: [
            { coordinates: [start.longitude, start.latitude] },
            { coordinates: [end.longitude, end.latitude] },
          ],
        })
        .send();

      const route = response.body.routes[0];
      const steps = route.legs[0].steps.map(step => ({
        instruction: step.maneuver.instruction,
        distance: step.distance,
        duration: step.duration,
        type: step.maneuver.type,
        modifier: step.maneuver.modifier,
        coordinates: step.geometry.coordinates
      }));

      setRouteSteps(steps);
      setCurrentStep(0);
      return steps;
    } catch (error) {
      console.error('Error getting directions:', error);
      return [];
    }
  };

  // Function to handle property selection
  const handlePropertySelect = async (property) => {
    setSelectedProperty(property);
    setIsExpanded(false);
    expandAnim.setValue(0);
    
    // Calculate real distance when property is selected
    if (location && property.location) {
      const dist = calculateDistance(
        location.latitude,
        location.longitude,
        property.location.latitude,
        property.location.longitude
      );
      setRealDistance(dist);
    }
  };

  // Function to start navigation
  const startNavigation = async () => {
    if (location && selectedProperty?.location) {
      const steps = await getTurnByTurnDirections(
        { latitude: location.latitude, longitude: location.longitude },
        { latitude: selectedProperty.location.latitude, longitude: selectedProperty.location.longitude }
      );
      if (steps.length > 0) {
        setNavigationMode(true);
        Animated.spring(slideAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 50,
          friction: 7
        }).start();
      }
    }
  };

  // Function to toggle contact modal
  const toggleContactModal = () => {
    setShowContactModal(!showContactModal);
    Animated.spring(contactAnim, {
      toValue: showContactModal ? 0 : 1,
      useNativeDriver: true,
      tension: 50,
      friction: 7
    }).start();
  };

  // Function to toggle booking modal
  const toggleBookingModal = () => {
    setShowBookingModal(!showBookingModal);
    Animated.spring(bookingAnim, {
      toValue: showBookingModal ? 0 : 1,
      useNativeDriver: true,
      tension: 50,
      friction: 7
    }).start();
  };

  // Function to toggle actions panel
  const toggleActionsPanel = () => {
    setShowActionsPanel(!showActionsPanel);
    Animated.spring(actionsAnim, {
      toValue: showActionsPanel ? 0 : 1,
      useNativeDriver: true,
      tension: 50,
      friction: 7
    }).start();
  };

  // Function to toggle host contact section
  const toggleHostContact = () => {
    setShowHostContact(!showHostContact);
    Animated.spring(hostContactAnim, {
      toValue: showHostContact ? 0 : 1,
      useNativeDriver: false,
      tension: 50,
      friction: 7
    }).start();
  };

  // Function to toggle image viewer
  const toggleImageViewer = (index = 0) => {
    if (!showImageViewer) {
      setCurrentImageIndex(index);
    }
    setShowImageViewer(!showImageViewer);
    Animated.spring(imageViewerAnim, {
      toValue: showImageViewer ? 0 : 1,
      useNativeDriver: true,
      tension: 50,
      friction: 7
    }).start();
  };

  // Function to handle image scroll
  const handleImageScroll = (event) => {
    const scrollPosition = event.nativeEvent.contentOffset.x;
    const imageWidth = event.nativeEvent.layoutMeasurement.width;
    const index = Math.round(scrollPosition / imageWidth);
    setCurrentImageIndex(index);
  };

  // Function to close navigation
  const closeNavigation = () => {
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 50,
      friction: 7
    }).start(() => {
      setNavigationMode(false);
    });
  };

  // Function to get direction icon based on maneuver type
  const getDirectionIcon = (type, modifier) => {
    switch (type) {
      case 'turn':
        switch (modifier) {
          case 'left': return 'arrow-back';
          case 'right': return 'arrow-forward';
          case 'slight left': return 'arrow-back-outline';
          case 'slight right': return 'arrow-forward-outline';
          case 'sharp left': return 'return-up-back';
          case 'sharp right': return 'return-down-forward';
          default: return 'arrow-forward';
        }
      case 'arrive':
        return 'flag';
      case 'depart':
        return 'navigate';
      case 'continue':
        return 'arrow-forward';
      default:
        return 'navigate';
    }
  };

  return (
    <View style={styles.container}>
      {/* Modern Glassmorphism Header */}
      <BlurView intensity={95} tint="extraLight" style={styles.modernHeader}>
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            <View style={styles.logoContainer}>
              <Ionicons name="map" size={28} color="#8B5CF6" />
            </View>
            <View>
              <Text style={styles.headerTitle}>Property Explorer</Text>
              <Text style={styles.headerSubtitle}>AI-Powered Smart Search</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.headerAction}>
            <Ionicons name="options" size={24} color="#6B7280" />
          </TouchableOpacity>
        </View>
      </BlurView>

      {/* Advanced Cluster Filter Cards */}
      <View style={styles.modernFilterContainer}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScrollContent}
          style={styles.filterScroll}
        >
          {staticLabels.map((name, idx) => {
           
            const icons = ['wallet', 'home', 'diamond', 'grid'];
            return (
              <TouchableOpacity
                key={name}
                style={[
                  styles.modernFilterCard,
                  selectedCluster === idx && styles.selectedFilterCard
                ]}
                onPress={() => setSelectedCluster(idx)}
                activeOpacity={0.8}
              >
                <View style={[
                  styles.filterIconContainer,
                  selectedCluster === idx && { backgroundColor: staticColors[idx] }
                ]}>
                  <Ionicons 
                    name={icons[idx]} 
                    size={20} 
                    color={selectedCluster === idx ? '#fff' : staticColors[idx]} 
                  />
                </View>
                <Text style={[
                  styles.filterCardTitle,
                  selectedCluster === idx && { color: staticColors[idx], fontWeight: '700' }
                ]}>
                  {name}
                </Text>
                <Text style={[
                  styles.filterCardSubtitle,
                  selectedCluster === idx && { color: staticColors[idx] }
                ]}>
                 
                </Text>
                {selectedCluster === idx && (
                  <View style={[styles.filterActiveIndicator, { backgroundColor: staticColors[idx] }]} />
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Advanced Loading Overlay */}
      {loadingML && (
        <BlurView intensity={90} tint="systemMaterial" style={styles.modernLoadingOverlay}>
          <View style={styles.loadingCard}>
            <View style={styles.loadingIconContainer}>
              <Ionicons name="analytics" size={32} color="#8B5CF6" style={styles.loadingIcon} />
              <View style={styles.loadingPulse} />
            </View>
            <Text style={styles.modernLoadingTitle}>AI Processing</Text>
            <Text style={styles.modernLoadingSubtitle}>Analyzing property clusters with K-means algorithm</Text>
            <View style={styles.loadingProgress}>
              <View style={styles.progressBar} />
            </View>
          </View>
        </BlurView>
      )}

      {/* Modern Empty States */}
      {!loadingML && (
        mlProperties.length === 0 ? (
          <View style={styles.centeredEmptyState}>
            <BlurView intensity={85} tint="systemMaterial" style={styles.emptyStateCard}>
              <View style={styles.emptyStateIcon}>
                <Ionicons name="home-outline" size={48} color="#8B5CF6" />
                <View style={styles.emptyStateIconBg} />
              </View>
              <Text style={styles.emptyStateTitle}>No Properties Available</Text>
              <Text style={styles.emptyStateMessage}>
                {!location ? 'Waiting for your location to load nearby properties...' : 'We couldn\'t find any properties. Please check your connection and try again.'}
              </Text>
              <TouchableOpacity 
                style={styles.modernRetryButton}
                onPress={() => setRefresh(!refresh)}
                activeOpacity={0.8}
              >
                <Ionicons name="refresh" size={20} color="#fff" />
                <Text style={styles.modernRetryText}>Retry Search</Text>
              </TouchableOpacity>
            </BlurView>
          </View>
        ) : filteredProperties.length === 0 ? (
          <View style={styles.centeredEmptyState}>
            <BlurView intensity={85} tint="systemMaterial" style={styles.emptyStateCard}>
              <View style={styles.emptyStateIcon}>
                <Ionicons name="search-outline" size={48} color="#F59E0B" />
                <View style={[styles.emptyStateIconBg, { backgroundColor: '#FEF3C7' }]} />
              </View>
              <Text style={styles.emptyStateTitle}>No {staticLabels[selectedCluster]} Properties</Text>
              <Text style={styles.emptyStateMessage}>
                We couldn't find any properties in the {staticLabels[selectedCluster].toLowerCase()} category. Try exploring other price ranges.
              </Text>
              <View style={styles.emptyStateActions}>
                <TouchableOpacity 
                  style={styles.modernSecondaryButton}
                  onPress={() => setSelectedCluster(3)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="apps-outline" size={18} color="#6B7280" />
                  <Text style={styles.modernSecondaryText}>View All</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.modernPrimaryButton}
                  onPress={() => setRefresh(!refresh)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="refresh" size={18} color="#fff" />
                  <Text style={styles.modernPrimaryText}>Refresh</Text>
                </TouchableOpacity>
              </View>
            </BlurView>
          </View>
        ) : null
      )}



      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_GOOGLE}
        initialRegion={{
          latitude: 13.6218,
          longitude: 123.1948,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
        showsUserLocation={true}
        showsMyLocationButton={true}
        zoomEnabled={true}
        moveOnMarkerPress={false}
        tracksViewChanges={false}
      >
        {location && (
          <Marker
            coordinate={{
              latitude: location.latitude,
              longitude: location.longitude,
            }}
            image={Person}
            tracksViewChanges={false}
          />
        )}

        {filteredProperties.map((property, index) => {
          if (!property.location) return null;
          
          // Calculate distance for each property
          const propDistance = location ? calculateDistance(
            location.latitude,
            location.longitude,
            property.location.latitude,
            property.location.longitude
          ) : null;
          
          // Get cluster color for the house icon
          const clusterIndex = selectedCluster === 3 ? property.cluster : selectedCluster;
          const clusterColor = staticColors[clusterIndex] || staticColors[0];
          
          return (
            <Marker
              key={property._id || index}
              coordinate={{
                latitude: property.location.latitude,
                longitude: property.location.longitude,
              }}
              title={property.name}
              description={`₱${property.price} | ${property.propertyType || ''} | ${propDistance ? `${propDistance.toFixed(1)}km` : ''}`}
              onPress={() => handlePropertySelect(property)}
              tracksViewChanges={false}
            >
              {/* Custom House Icon Marker */}
              <View style={[styles.customMarker, { backgroundColor: clusterColor }]}>
                <Ionicons name="home" size={24} color="#fff" />
                <View style={[styles.markerTriangle, { borderTopColor: clusterColor }]} />
              </View>
            </Marker>
          );
        })}

        {routeCoords.length > 0 && (
          <Polyline 
            coordinates={routeCoords} 
            strokeWidth={4} 
            strokeColor={COLORS.primary}
            lineDashPattern={[1]}
            tracksViewChanges={false}
          />
        )}
      </MapView>

      {/* Full Screen Property Modal */}
      {selectedProperty && (
        <Animated.View 
          style={[
            styles.fullScreenModal,
            {
              transform: [{
                translateY: expandAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 0]
                })
              }]
            }
          ]}
        >
          {/* Modal Header with Close Button - Glassmorphism */}
          <BlurView intensity={95} tint="light" style={styles.fullScreenHeader}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => {
                setSelectedProperty(null);
                setIsExpanded(false);
                expandAnim.setValue(0);
                setCurrentImageIndex(0);
              }}
            >
              <Ionicons name="arrow-back" size={24} color="#111827" />
            </TouchableOpacity>
            <Text style={styles.fullScreenHeaderTitle}>Property Details</Text>
            <TouchableOpacity style={styles.headerFavoriteButton}>
              <Ionicons name="heart-outline" size={24} color="#E91E63" />
            </TouchableOpacity>
          </BlurView>
          
          {/* Property Image Slider */}
          <View style={styles.imageSliderContainer}>
            <ScrollView
              ref={scrollViewRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={handleImageScroll}
              scrollEventThrottle={16}
              style={styles.imageSlider}
            >
              {(selectedProperty.images && selectedProperty.images.length > 0 ? selectedProperty.images : [getImageUri(selectedProperty)]).map((image, index) => (
                <TouchableOpacity
                  key={index}
                  activeOpacity={0.9}
                  onPress={() => toggleImageViewer(index)}
                  style={styles.imageSlide}
                >
                  <Image
                    source={{ uri: image }}
                    style={styles.sliderImage}
                    resizeMode="cover"
                  />
                </TouchableOpacity>
              ))}
            </ScrollView>
            
            {/* Image Counter Badge */}
            <View style={styles.imageCounterBadge}>
              <Ionicons name="images" size={14} color="#fff" />
              <Text style={styles.imageCounterText}>
                {currentImageIndex + 1}/{selectedProperty.images?.length || 1}
              </Text>
            </View>
            
            {/* Property Type Badge */}
            <View style={styles.propertyBadgeOverlay}>
              <View style={styles.propertyBadgeFullScreen}>
                <Ionicons name="home" size={16} color="#fff" />
                <Text style={styles.badgeTextFullScreen}>{selectedProperty.propertyType || 'Property'}</Text>
              </View>
            </View>
            
            {/* Pagination Dots */}
            {selectedProperty.images && selectedProperty.images.length > 1 && (
              <View style={styles.paginationDots}>
                {selectedProperty.images.map((_, index) => (
                  <View
                    key={index}
                    style={[
                      styles.paginationDot,
                      currentImageIndex === index && styles.paginationDotActive
                    ]}
                  />
                ))}
              </View>
            )}
          </View>
          
          {/* Scrollable Content */}
          <ScrollView 
            style={styles.fullScreenContentScroll} 
            showsVerticalScrollIndicator={false}
            bounces={true}
          >
            {/* Property Header - Optimized */}
            <View style={styles.fullScreenPropertyHeader}>
              <View style={styles.propertyTitleRow}>
                <View style={styles.propertyTitleContainer}>
                  <Text style={styles.fullScreenPropertyTitle}>{selectedProperty.name}</Text>
                  <View style={styles.propertyBadgeContainer}>
                    <View style={styles.propertyTypeBadge}>
                      <Ionicons name="home" size={12} color={COLORS.primary} />
                      <Text style={styles.propertyTypeText}>{selectedProperty.propertyType || 'Property'}</Text>
                    </View>
                  </View>
                </View>
                <TouchableOpacity style={styles.favoriteButtonLarge}>
                  <Ionicons name="heart-outline" size={24} color="#E91E63" />
                </TouchableOpacity>
              </View>
              
              <View style={styles.priceAndRatingContainer}>
                <View style={styles.fullScreenPriceContainer}>
                  <Text style={styles.fullScreenPrice}>₱{selectedProperty.price?.toLocaleString()}</Text>
                  <Text style={styles.fullScreenPriceLabel}>/month</Text>
                </View>
                <View style={styles.ratingContainer}>
                  <Ionicons name="star" size={14} color="#FFD700" />
                  <Text style={styles.ratingText}>4.8</Text>
                  <Text style={styles.reviewCount}>(124)</Text>
                </View>
              </View>
            </View>

            {/* Location Card - Optimized */}
            <View style={styles.fullScreenLocationCard}>
              <View style={styles.locationHeader}>
                <Ionicons name="location" size={20} color={COLORS.primary} />
                <Text style={styles.locationTitle}>Location</Text>
              </View>
              <Text style={styles.fullScreenAddress}>{selectedProperty.location?.address}</Text>
              <View style={styles.locationActions}>
                <TouchableOpacity style={styles.locationActionButton}>
                  <Ionicons name="map-outline" size={16} color={COLORS.primary} />
                  <Text style={styles.locationActionText}>View Map</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.locationActionButton}>
                  <Ionicons name="car-outline" size={16} color={COLORS.primary} />
                  <Text style={styles.locationActionText}>
                    {realDistance ? `${realDistance.toFixed(1)} km` : '2.5 km'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Description Card */}
            <View style={styles.modernCard}>
              <View style={styles.cardHeader}>
                <Ionicons name="document-text-outline" size={24} color={COLORS.primary} />
                <Text style={styles.cardTitle}>About this property</Text>
              </View>
              <Text style={styles.modernDescription}>
                {selectedProperty.description?.slice(0, 150) || "Experience comfortable living in this beautifully designed space with modern amenities."}
                {selectedProperty.description?.length > 150 ? '...' : ''}
              </Text>
            </View>

            {/* Contact Information Card - Collapsible & Optimized */}
            <View style={styles.elegantContactCard}>
              <TouchableOpacity 
                style={styles.contactCardHeader}
                onPress={toggleHostContact}
                activeOpacity={0.8}
              >
                <View style={styles.contactHeaderLeft}>
                  <Ionicons name="person-circle" size={24} color="#8B5CF6" />
                  <Text style={styles.elegantContactTitle}>Owner Info</Text>
                </View>
                <View style={styles.contactHeaderRight}>
                  <View style={styles.hostRatingBadge}>
                    <Ionicons name="star" size={12} color="#FFD700" />
                    <Text style={styles.hostRating}>5.0</Text>
                  </View>
                  <Ionicons 
                    name={showHostContact ? "chevron-up" : "chevron-down"} 
                    size={20} 
                    color="#6B7280" 
                    style={{ marginLeft: 8 }}
                  />
                </View>
              </TouchableOpacity>
              
              {showHostContact && (
                <Animated.View style={{ opacity: hostContactAnim }}>
                  <View style={styles.elegantContactProfile}>
                    <View style={styles.elegantContactAvatar}>
                      <Ionicons name="person" size={28} color="#fff" />
                      <View style={styles.onlineIndicator} />
                    </View>
                    <View style={styles.elegantContactInfo}>
                      <Text style={styles.elegantContactName}>{selectedProperty.postedBy || 'Property Owner'}</Text>
                      <Text style={styles.elegantContactRole}>Owner • Verified</Text>
                      <View style={styles.hostStats}>
                        <View style={styles.hostStat}>
                          <Text style={styles.hostStatValue}>100%</Text>
                          <Text style={styles.hostStatLabel}>Response</Text>
                        </View>
                        <View style={styles.hostStatDivider} />
                        <View style={styles.hostStat}>
                          <Text style={styles.hostStatValue}>Fast</Text>
                          <Text style={styles.hostStatLabel}>Reply</Text>
                        </View>
                      </View>
                    </View>
                    <TouchableOpacity style={styles.elegantMessageButton}>
                      <Ionicons name="chatbubble-ellipses" size={20} color="#8B5CF6" />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.hostDescription}>
                    "Hi! I'm the owner of this property. Feel free to contact me for viewings or any questions."
                  </Text>
                </Animated.View>
              )}
            </View>

            {/* Features & Amenities Card - Optimized */}
            <View style={styles.elegantFeaturesCard}>
              <View style={styles.featuresCardHeader}>
                <Ionicons name="sparkles" size={22} color="#8B5CF6" />
                <Text style={styles.elegantFeaturesTitle}>Amenities</Text>
              </View>
              <View style={styles.elegantFeaturesGrid}>
                <View style={styles.elegantFeatureItem}>
                  <View style={styles.elegantFeatureIcon}>
                    <Ionicons name="bed" size={18} color="#8B5CF6" />
                  </View>
                  <View style={styles.featureTextContainer}>
                    <Text style={styles.elegantFeatureTitle}>Furnished</Text>
                    <Text style={styles.elegantFeatureDesc}>Premium decor</Text>
                  </View>
                </View>
                <View style={styles.elegantFeatureItem}>
                  <View style={styles.elegantFeatureIcon}>
                    <Ionicons name="wifi" size={18} color="#10B981" />
                  </View>
                  <View style={styles.featureTextContainer}>
                    <Text style={styles.elegantFeatureTitle}>WiFi</Text>
                    <Text style={styles.elegantFeatureDesc}>500 Mbps</Text>
                  </View>
                </View>
                <View style={styles.elegantFeatureItem}>
                  <View style={styles.elegantFeatureIcon}>
                    <Ionicons name="car-sport" size={18} color="#F59E0B" />
                  </View>
                  <View style={styles.featureTextContainer}>
                    <Text style={styles.elegantFeatureTitle}>Parking</Text>
                    <Text style={styles.elegantFeatureDesc}>Covered garage</Text>
                  </View>
                </View>
              </View>
              <View style={styles.additionalAmenities}>
                <View style={styles.amenitiesList}>
                  <View style={styles.amenityTag}>
                    <Ionicons name="shield-checkmark" size={12} color="#10B981" />
                    <Text style={styles.amenityText}>Security</Text>
                  </View>
                  <View style={styles.amenityTag}>
                    <Ionicons name="flash" size={12} color="#F59E0B" />
                    <Text style={styles.amenityText}>Power</Text>
                  </View>
                  <View style={styles.amenityTag}>
                    <Ionicons name="fitness" size={12} color="#8B5CF6" />
                    <Text style={styles.amenityText}>Gym</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Bottom spacing for actions */}
            <View style={{ height: 140 }} />
          </ScrollView>

          {/* Fixed Bottom Actions */}
          <View style={styles.fullScreenBottomActions}>
            <View style={styles.fullScreenActionsRow}>
              <TouchableOpacity 
                style={styles.fullScreenPrimaryButton} 
                onPress={() => alert(`Contact owner for ${selectedProperty.name}`)}
              >
                <Ionicons name="call" size={24} color="#fff" />
                <Text style={styles.fullScreenPrimaryButtonText}>Contact Owner</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.fullScreenSecondaryButton} 
                onPress={() => alert(`Booking request for ${selectedProperty.name}`)}
              >
                <Ionicons name="calendar" size={24} color={COLORS.primary} />
                <Text style={styles.fullScreenSecondaryButtonText}>Book Visit</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity 
              style={styles.fullScreenNavigationButton}
              onPress={startNavigation}
            >
              <Ionicons name="navigate" size={26} color="#fff" />
              <Text style={styles.fullScreenNavigationText}>Turn by turn navigation</Text>
            </TouchableOpacity>
          </View>

          {/* Navigation Modal - Overlay on Property Modal */}
          {navigationMode && (
            <Animated.View 
              style={[
                styles.navigationOverlay,
                {
                  transform: [{
                    translateY: slideAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-300, 0]
                    })
                  }]
                }
              ]}
            >
              <View style={styles.navigationHeader}>
                <Text style={styles.navigationTitle}>Turn-by-Turn Navigation</Text>
                <TouchableOpacity 
                  style={styles.closeNavigationButton}
                  onPress={closeNavigation}
                >
                  <Ionicons name="close" size={24} color={COLORS.primary} />
                </TouchableOpacity>
              </View>
              
              <View style={styles.currentStepContainer}>
                <Ionicons 
                  name={getDirectionIcon(routeSteps[currentStep]?.type, routeSteps[currentStep]?.modifier)} 
                  size={32} 
                  color={COLORS.primary} 
                />
                <View style={styles.stepInfo}>
                  <Text style={styles.stepInstruction}>{routeSteps[currentStep]?.instruction}</Text>
                  <Text style={styles.stepDistance}>
                    {Math.round(routeSteps[currentStep]?.distance || 0)}m • {Math.round(routeSteps[currentStep]?.duration || 0)}s
                  </Text>
                </View>
              </View>

              <ScrollView 
                style={styles.stepsList}
                contentContainerStyle={styles.stepsListContent}
                bounces={false}
                showsVerticalScrollIndicator={true}
              >
                {routeSteps.map((step, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.stepItem,
                      index === currentStep && styles.currentStepItem
                    ]}
                    onPress={() => setCurrentStep(index)}
                  >
                    <Ionicons 
                      name={getDirectionIcon(step.type, step.modifier)} 
                      size={20} 
                      color={index === currentStep ? '#fff' : COLORS.primary} 
                    />
                    <Text style={[
                      styles.stepItemText,
                      index === currentStep && styles.currentStepText
                    ]}>
                      {step.instruction}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </Animated.View>
          )}

          {/* Full Screen Image Viewer Modal */}
          {showImageViewer && (
            <Animated.View
              style={[
                styles.imageViewerModal,
                {
                  opacity: imageViewerAnim,
                  transform: [{
                    scale: imageViewerAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.8, 1]
                    })
                  }]
                }
              ]}
            >
              <View style={styles.imageViewerHeader}>
                <TouchableOpacity
                  style={styles.imageViewerCloseButton}
                  onPress={() => toggleImageViewer()}
                >
                  <Ionicons name="close" size={28} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.imageViewerCounter}>
                  {currentImageIndex + 1} / {selectedProperty.images?.length || 1}
                </Text>
                <TouchableOpacity style={styles.imageViewerShareButton}>
                  <Ionicons name="share-outline" size={24} color="#fff" />
                </TouchableOpacity>
              </View>

              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={handleImageScroll}
                scrollEventThrottle={16}
                contentOffset={{ x: currentImageIndex * 400, y: 0 }}
                style={styles.imageViewerScroll}
              >
                {(selectedProperty.images && selectedProperty.images.length > 0 ? selectedProperty.images : [getImageUri(selectedProperty)]).map((image, index) => (
                  <View key={index} style={styles.imageViewerSlide}>
                    <Image
                      source={{ uri: image }}
                      style={styles.imageViewerImage}
                      resizeMode="contain"
                    />
                  </View>
                ))}
              </ScrollView>

              {/* Image Viewer Pagination */}
              {selectedProperty.images && selectedProperty.images.length > 1 && (
                <View style={styles.imageViewerPagination}>
                  {selectedProperty.images.map((_, index) => (
                    <View
                      key={index}
                      style={[
                        styles.imageViewerDot,
                        currentImageIndex === index && styles.imageViewerDotActive
                      ]}
                    />
                  ))}
                </View>
              )}
            </Animated.View>
          )}
        </Animated.View>
      )}

      {/* Floating Action Button */}
      <View style={styles.fabContainer}>
        <TouchableOpacity 
          style={styles.modernFab}
          onPress={() => setRefresh(!refresh)}
          activeOpacity={0.8}
        >
          <BlurView intensity={90} tint="systemMaterial" style={styles.fabBlur}>
            <Ionicons name="refresh" size={24} color="#8B5CF6" />
          </BlurView>
        </TouchableOpacity>
      </View>

      {/* Modern Distance Info Card */}
      {(distance || realDistance) && selectedProperty && (
        <View style={styles.modernInfoCardContainer}>
          <BlurView intensity={90} tint="systemMaterial" style={styles.modernInfoCard}>
            <View style={styles.infoIconContainer}>
              <Ionicons name="navigate" size={18} color="#8B5CF6" />
            </View>
            <View style={styles.infoTextContainer}>
              <Text style={styles.modernInfoTitle}>
                {distance ? `${distance.toFixed(1)} km` : `${realDistance.toFixed(1)} km`}
              </Text>
              <Text style={styles.modernInfoSubtitle}>
                {distance ? `${duration.toFixed(0)} min drive` : 'Direct distance'}
              </Text>
            </View>
          </BlurView>
        </View>
      )}

      {/* Map Distance Overlay */}
      {realDistance && selectedProperty && location && (
        <View style={styles.mapDistanceOverlay}>
          <View style={styles.distanceCard}>
            <Ionicons name="location" size={16} color="#8B5CF6" />
            <Text style={styles.distanceText}>{realDistance.toFixed(1)} km</Text>
          </View>
        </View>
      )}

      {!isLocationPermissionGranted && (
        <View style={styles.permissionView}>
          <Text style={styles.permissionText}>Location permission is required</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f6f8fa',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    zIndex: 100,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  clusterButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginTop: 70,
    marginBottom: 8,
    zIndex: 10,
    position: 'absolute',
    width: '100%',
    paddingHorizontal: 8,
  },
  clusterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  clusterButtonText: {
    color: '#333',
    fontWeight: '600',
    fontSize: 14,
  },
  filterPanel: {
    display: 'none',
  },
  loadingContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -100 }, { translateY: -30 }],
    backgroundColor: 'rgba(255,255,255,0.9)',
    padding: 20,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 99,
  },
  loadingIcon: {
    marginRight: 10,
  },
  loadingText: {
    color: COLORS.primary,
    fontWeight: 'bold',
  },
  fullScreenModal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FAFBFC',
    zIndex: 1000,
  },
  navigationOverlay: {
    position: 'absolute',
    top: 100,
    left: 10,
    right: 10,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    maxHeight: '70%',
    elevation: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    zIndex: 1200,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.2)',
  },
  fullScreenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingTop: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.2)',
    overflow: 'hidden',
  },
  backButton: {
    backgroundColor: 'rgba(248, 250, 252, 0.8)',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(229, 231, 235, 0.5)',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 3,
  },
  fullScreenHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -0.3,
  },
  headerFavoriteButton: {
    backgroundColor: 'rgba(254, 242, 242, 0.9)',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(254, 226, 226, 0.5)',
    shadowColor: '#E91E63',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 3,
  },
  imageSliderContainer: {
    position: 'relative',
    height: 280,
    width: '100%',
    backgroundColor: '#000',
  },
  imageSlider: {
    flex: 1,
  },
  imageSlide: {
    width: 400,
    height: 280,
  },
  sliderImage: {
    width: '100%',
    height: '100%',
  },
  imageCounterBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  imageCounterText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  propertyBadgeOverlay: {
    position: 'absolute',
    bottom: 16,
    left: 16,
  },
  propertyBadgeFullScreen: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(139, 92, 246, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  badgeTextFullScreen: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  paginationDots: {
    position: 'absolute',
    bottom: 16,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  paginationDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  paginationDotActive: {
    width: 20,
    backgroundColor: '#fff',
  },
  fullScreenContentScroll: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 6,
  },
  fullScreenPropertyHeader: {
    paddingTop: 20,
    paddingBottom: 16,
    paddingHorizontal: 4,
  },
  propertyTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  propertyTitleContainer: {
    flex: 1,
    paddingRight: 16,
  },
  fullScreenPropertyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 6,
    lineHeight: 28,
    letterSpacing: -0.5,
  },
  propertyBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  propertyTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  propertyTypeText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.primary,
    marginLeft: 5,
    textTransform: 'capitalize',
  },
  favoriteButtonLarge: {
    backgroundColor: '#FEF2F2',
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  priceAndRatingContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fullScreenPriceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  fullScreenPrice: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: -0.8,
  },
  fullScreenPriceLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 6,
    fontWeight: '500',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FEF3C7',
  },
  ratingText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#92400E',
    marginLeft: 3,
  },
  reviewCount: {
    fontSize: 11,
    color: '#78716C',
    marginLeft: 3,
  },
  modernCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginLeft: 10,
    letterSpacing: -0.3,
  },
  fullScreenLocationCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  locationTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginLeft: 10,
    letterSpacing: -0.3,
  },
  fullScreenAddress: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 21,
    marginBottom: 12,
    fontWeight: '500',
  },
  locationActions: {
    flexDirection: 'row',
    gap: 10,
  },
  locationActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    flex: 1,
  },
  locationActionText: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '600',
    marginLeft: 6,
  },
  modernDescription: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 22,
    fontWeight: '400',
    marginBottom: 0,
  },
  readMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  readMoreText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
    marginRight: 4,
  },
  modernFeaturesGrid: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 20,
  },
  modernFeatureItem: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingVertical: 20,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  featureIconContainer: {
    backgroundColor: '#EEF2FF',
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  modernFeatureTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 4,
  },
  modernFeatureSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    fontWeight: '500',
  },
  additionalFeatures: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  featureTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  featureTagText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    marginLeft: 6,
  },
  elegantContactCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 14,
    marginBottom: 12,
    marginHorizontal: 4,
    shadowColor: '#8B5CF6',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#F8FAFC',
  },
  contactCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  contactHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  contactHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  elegantContactTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginLeft: 10,
    letterSpacing: -0.3,
  },
  hostRatingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FEF3C7',
  },
  hostRating: {
    fontSize: 12,
    fontWeight: '700',
    color: '#92400E',
    marginLeft: 3,
  },
  elegantContactProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  elegantContactAvatar: {
    position: 'relative',
    backgroundColor: 'linear-gradient(135deg, #8B5CF6, #A855F7)',
    backgroundColor: '#8B5CF6',
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    shadowColor: '#8B5CF6',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 6,
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#fff',
  },
  elegantContactInfo: {
    flex: 1,
  },
  elegantContactName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 3,
    letterSpacing: -0.2,
  },
  elegantContactRole: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 8,
    fontWeight: '500',
  },
  hostStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  hostStat: {
    alignItems: 'center',
  },
  hostStatValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#8B5CF6',
  },
  hostStatLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  hostStatDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 16,
  },
  elegantMessageButton: {
    backgroundColor: '#F3F4F6',
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  hostDescription: {
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 20,
    fontStyle: 'italic',
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 14,
    borderLeftWidth: 3,
    borderLeftColor: '#8B5CF6',
  },
  elegantFeaturesCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 14,
    marginBottom: 12,
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 1,
    borderColor: '#F8FAFC',
  },
  featuresCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  elegantFeaturesTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginLeft: 10,
    letterSpacing: -0.3,
  },
  elegantFeaturesGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 12,
  },
  elegantFeatureItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAFBFC',
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F1F3F4',
  },
  elegantFeatureIcon: {
    backgroundColor: '#fff',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  featureTextContainer: {
    flex: 1,
  },
  elegantFeatureTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 1,
  },
  elegantFeatureDesc: {
    fontSize: 10,
    color: '#6B7280',
    fontWeight: '500',
  },
  additionalAmenities: {
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  amenitiesTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 8,
  },
  amenitiesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  amenityTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  amenityText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#374151',
    marginLeft: 5,
  },
  fullScreenBottomActions: {
    position: 'absolute',
    bottom: 90, // Adjust for tab bar height
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    borderRadius: 16,
    marginHorizontal: 8,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: -4 },
    shadowRadius: 12,
    elevation: 10,
  },
  fullScreenActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  fullScreenPrimaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.secondary,
    paddingVertical: 12,
    borderRadius: 14,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 6,
  },
  fullScreenPrimaryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 6,
  },
  fullScreenSecondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: 14,
  },
  fullScreenSecondaryButtonText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 6,
  },
  fullScreenNavigationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#8B5CF6',
    paddingVertical: 13,
    borderRadius: 14,
    shadowColor: '#8B5CF6',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 6,
  },
  fullScreenNavigationText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 6,
  },
  refreshButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: COLORS.primary,
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  infoBox: {
    position: 'absolute',
    top: 130,
    alignSelf: 'center',
    width: '90%',
    padding: 12,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    backgroundColor: 'rgba(255,255,255,0.9)',
    zIndex: 20,
  },
  infoContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
    marginLeft: 8,
  },
  mapDistanceOverlay: {
    position: 'absolute',
    top: 200,
    right: 20,
    zIndex: 25,
  },
  distanceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 5,
  },
  distanceText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#8B5CF6',
    marginLeft: 6,
  },
  permissionView: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -150 }, { translateY: -30 }],
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 20,
    borderRadius: 10,
  },
  permissionText: {
    color: 'white',
    fontSize: 18,
    textAlign: 'center',
  },
  navigationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    paddingVertical: 12,
    marginTop: 12,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 4,
  },
  navigationButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    letterSpacing: 0.3,
  },
  navigationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  navigationTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  closeNavigationButton: {
    padding: 4,
  },
  currentStepContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  stepInfo: {
    marginLeft: 16,
    flex: 1,
  },
  stepInstruction: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  stepDistance: {
    fontSize: 14,
    color: '#666',
  },
  stepsList: {
    flex: 1,
  },
  stepsListContent: {
    paddingBottom: 20,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#f8f8f8',
  },
  currentStepItem: {
    backgroundColor: COLORS.primary,
  },
  stepItemText: {
    marginLeft: 12,
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  currentStepText: {
    color: '#fff',
  },
  
  // Modern Header Styles
  modernHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 100,
    zIndex: 100,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.08)',
    overflow: 'hidden',
  },
  headerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoContainer: {
    backgroundColor: '#F3F4F6',
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: -0.5,
    lineHeight: 24,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
    marginTop: 2,
  },
  headerAction: {
    backgroundColor: '#F9FAFB',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },

  // Modern Filter Styles
  modernFilterContainer: {
    position: 'absolute',
    top: 110,
    left: 0,
    right: 0,
    zIndex: 90,
    height: 120,
  },
  filterScroll: {
    paddingHorizontal: 20,
  },
  filterScrollContent: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  modernFilterCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    marginHorizontal: 8,
    minWidth: 100,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    position: 'relative',
  },
  selectedFilterCard: {
    backgroundColor: '#fff',
    borderWidth: 2,
    transform: [{ scale: 1.05 }],
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  filterIconContainer: {
    backgroundColor: '#F8FAFC',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
    marginBottom: 2,
  },
  filterCardSubtitle: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '500',
    textAlign: 'center',
  },
  filterActiveIndicator: {
    position: 'absolute',
    bottom: -2,
    left: '50%',
    marginLeft: -12,
    width: 24,
    height: 4,
    borderRadius: 2,
  },

  // Modern Loading Styles
  modernLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  loadingCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 24,
    elevation: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    minWidth: 280,
  },
  loadingIconContainer: {
    position: 'relative',
    marginBottom: 20,
  },
  loadingIcon: {
    zIndex: 2,
  },
  loadingPulse: {
    position: 'absolute',
    top: -8,
    left: -8,
    right: -8,
    bottom: -8,
    backgroundColor: '#8B5CF6',
    borderRadius: 24,
    opacity: 0.2,
    transform: [{ scale: 1.2 }],
  },
  modernLoadingTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  modernLoadingSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  loadingProgress: {
    width: '100%',
    height: 4,
    backgroundColor: '#F3F4F6',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    width: '60%',
    height: '100%',
    backgroundColor: '#8B5CF6',
    borderRadius: 2,
  },

  // Centered Empty State Styles
  centeredEmptyState: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
    paddingHorizontal: 20,
  },
  emptyStateCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 24,
    elevation: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    maxWidth: 320,
    width: '100%',
  },
  emptyStateIcon: {
    position: 'relative',
    marginBottom: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateIconBg: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#EEF2FF',
    zIndex: -1,
  },
  emptyStateTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: -0.4,
  },
  emptyStateMessage: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  emptyStateActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modernRetryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#8B5CF6',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 16,
    shadowColor: '#8B5CF6',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 6,
    flex: 1,
  },
  modernRetryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },
  modernSecondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    flex: 1,
  },
  modernSecondaryText: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  modernPrimaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#8B5CF6',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 16,
    shadowColor: '#8B5CF6',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 6,
    flex: 1,
  },
  modernPrimaryText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 6,
  },

  // Floating Action Button Styles
  fabContainer: {
    position: 'absolute',
    bottom: 120,
    right: 20,
    zIndex: 100,
  },
  modernFab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 8,
  },
  fabBlur: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },

  // Modern Info Card Styles
  modernInfoCardContainer: {
    position: 'absolute',
    top: 240,
    left: 20,
    right: 20,
    zIndex: 30,
    alignItems: 'center',
  },
  modernInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    minWidth: 200,
  },
  infoIconContainer: {
    backgroundColor: '#F3F4F6',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  infoTextContainer: {
    flex: 1,
  },
  modernInfoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    lineHeight: 20,
  },
  modernInfoSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
    marginTop: 2,
  },

  // Legacy styles (keeping for compatibility)
  noPropertiesContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -100 }, { translateY: -60 }],
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    padding: 24,
    borderRadius: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.3)',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 8,
    zIndex: 99,
    minWidth: 200,
  },
  noPropertiesText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginTop: 8,
    textAlign: 'center',
  },
  noPropertiesSubtext: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 12,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },

  // Custom House Marker Styles
  customMarker: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 40,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 2,
    borderColor: '#fff',
  },
  markerTriangle: {
    position: 'absolute',
    bottom: -8,
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#4CAF50', // This will be overridden by the dynamic color
  },
  // Image Viewer Modal Styles
  imageViewerModal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000',
    zIndex: 2000,
  },
  imageViewerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
    backgroundColor: 'rgba(0,0,0,0.8)',
    zIndex: 10,
  },
  imageViewerCloseButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageViewerCounter: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  imageViewerShareButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageViewerScroll: {
    flex: 1,
  },
  imageViewerSlide: {
    width: 400,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageViewerImage: {
    width: '100%',
    height: '100%',
  },
  imageViewerPagination: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  imageViewerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  imageViewerDotActive: {
    width: 24,
    backgroundColor: '#fff',
  },
});
