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
  const [selectedCluster, setSelectedCluster] = useState(0);
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

  // Fetch clustered properties from ML API
  useEffect(() => {
    const fetchMLClusters = async () => {
      setLoadingML(true);
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLoadingML(false);
        Alert.alert('Permission denied', 'Location permission is required');
        return;
      }
      let location = await Location.getCurrentPositionAsync({});
      // Default price for clustering, can be customized
      let price = 2000;
      try {
        // First fetch all properties to ensure we have complete data
        const fullPropertyRes = await fetch('https://rentify-server-ge0f.onrender.com/api/properties');
        const allProperties = await fullPropertyRes.json();

        // Then get ML recommendations
        const res = await fetch('https://ml-rentify.onrender.com/ml', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'kmeans', price, ...location.coords }),
        });
        const mlData = await res.json();
        
        if (Array.isArray(mlData)) {
          console.log('ML Data sample:', mlData[0]); // Debug log
          console.log('All Properties sample IDs:', allProperties.map(p => p._id).slice(0, 5)); // Debug log
          console.log('ML Data IDs:', mlData.map(p => p._id).slice(0, 5)); // Debug log
          
          // Merge ML recommendations with full property data
          const enrichedData = mlData.map(mlItem => {
            // Find the complete property data
            const fullProperty = allProperties.find(p => p._id === mlItem._id);
            console.log('ML Item ID:', mlItem._id); // Debug log
            console.log('Full Property found:', fullProperty ? 'YES' : 'NO'); // Debug log
            if (fullProperty) {
              console.log('Full Property images:', fullProperty.images); // Debug log
              return {
                ...fullProperty, // This includes all property data including images
                cluster: mlItem.cluster,
                location: fullProperty.location || mlItem.location
              };
            }
            console.log('Using ML Item directly (missing full data):', mlItem); // Debug log
            return mlItem;
          });
          
          // Fallback: If enrichment failed (no images), use all properties directly
          const hasImages = enrichedData.some(item => item.images && item.images.length > 0);
          console.log('Enriched data has images:', hasImages); // Debug log
          
          if (!hasImages && allProperties.length > 0) {
            console.log('Enrichment failed, using all properties as fallback'); // Debug log
            // Use all properties with artificial clusters for testing
            const fallbackData = allProperties.slice(0, 10).map((property, index) => ({
              ...property,
              cluster: index % 3, // Distribute across 3 clusters
            }));
            setMlProperties(fallbackData);
          } else {
            console.log('Using enriched data'); // Debug log
            setMlProperties(enrichedData);
          }
        }
      } catch (error) {
        console.error('Error fetching data:', error); // Debug log
        Alert.alert('ML API error', error.message || 'Failed to fetch clustered properties');
      }
      setLoadingML(false);
    };
    fetchMLClusters();
  }, [refresh]);

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

  // Dynamically map cluster indices to correct labels/colors by average price
  const staticLabels = ['Low Budget', 'Mid Range', 'High End'];
  const staticColors = ['#4CAF50', '#FFC107', '#E91E63'];

  // Compute average price for each cluster
  const clusterStats = [];
  for (let i = 0; i < 3; i++) {
    const props = mlProperties.filter(p => p.cluster === i);
    const avg = props.length ? props.reduce((sum, p) => sum + (p.price || 0), 0) / props.length : 0;
    clusterStats.push({ idx: i, avg, count: props.length });
  }
  // Sort clusters by average price ascending
  const sorted = [...clusterStats].sort((a, b) => a.avg - b.avg);
  // Map: clusterMap[buttonIdx] = clusterIndex
  const clusterMap = sorted.map(x => x.idx);

  // For rendering: labels/colors are always [low, mid, high] regardless of backend order
  const clusterNames = staticLabels;
  const clusterColors = staticColors;

  // selectedCluster is the button index (0/1/2), map to real cluster index
  const filteredProperties = mlProperties.filter(p => p.cluster === clusterMap[selectedCluster]);

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
      {/* Modern Header */}
      <BlurView intensity={80} tint="light" style={styles.header}>
        <Text style={styles.headerTitle}>Property Map</Text>
      </BlurView>

      {/* Cluster Filter Buttons with modern design */}
      <View style={styles.clusterButtonRow}>
        {clusterNames.map((name, idx) => (
          <TouchableOpacity
            key={name}
            style={[
              styles.clusterButton,
              selectedCluster === idx && { 
                backgroundColor: clusterColors[idx],
                transform: [{ scale: 1.05 }]
              }
            ]}
            onPress={() => setSelectedCluster(idx)}
            activeOpacity={0.85}
          >
            <Ionicons 
              name={idx === 0 ? "cash-outline" : idx === 1 ? "home-outline" : "diamond-outline"} 
              size={16} 
              color={selectedCluster === idx ? '#fff' : '#333'} 
              style={{ marginRight: 6 }}
            />
            <Text style={[styles.clusterButtonText, selectedCluster === idx && { color: '#fff' }]}>
              {name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Loading indicator with modern design */}
      {loadingML && (
        <BlurView intensity={80} tint="light" style={styles.loadingContainer}>
          <Ionicons name="sync" size={24} color={COLORS.primary} style={styles.loadingIcon} />
          <Text style={styles.loadingText}>Loading clusters...</Text>
        </BlurView>
      )}

      {/* No clusters found */}
      {!loadingML && mlProperties.length === 0 && (
        <View style={{ position: 'absolute', top: '50%', left: '50%', zIndex: 99, marginLeft: -100, marginTop: -30, backgroundColor: 'rgba(0,0,0,0.7)', padding: 20, borderRadius: 10 }}>
          <Text style={{ color: '#fff', fontWeight: 'bold', textAlign: 'center' }}>No clustered properties found.</Text>
        </View>
      )}

      {/* No properties in selected cluster */}
      {!loadingML && mlProperties.length > 0 && filteredProperties.length === 0 && (
        <View style={{ position: 'absolute', top: '50%', left: '50%', zIndex: 99, marginLeft: -100, marginTop: -30, backgroundColor: 'rgba(0,0,0,0.7)', padding: 20, borderRadius: 10 }}>
          <Text style={{ color: '#fff', fontWeight: 'bold', textAlign: 'center' }}>No properties in this cluster.</Text>
        </View>
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
          
          return (
            <Marker
              key={property._id || index}
              coordinate={{
                latitude: property.location.latitude,
                longitude: property.location.longitude,
              }}
              title={property.name}
              description={`₱${property.price} | ${property.propertyType || ''} | ${propDistance ? `${propDistance.toFixed(1)}km` : ''}`}
              pinColor={clusterColors[selectedCluster]}
              onPress={() => handlePropertySelect(property)}
              tracksViewChanges={false}
            />
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
          {/* Modal Header with Close Button */}
          <View style={styles.fullScreenHeader}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => {
                setSelectedProperty(null);
                setIsExpanded(false);
                expandAnim.setValue(0);
              }}
            >
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.fullScreenHeaderTitle}>Property Details</Text>
            <TouchableOpacity style={styles.headerFavoriteButton}>
              <Ionicons name="heart-outline" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          
          {/* Property Image with Gradient Overlay */}
          <View style={styles.fullScreenImageContainer}>
            <Image
              source={{ uri: getImageUri(selectedProperty) }}
              style={styles.fullScreenPropertyImage}
              resizeMode="cover"
            />
            <View style={styles.fullScreenImageGradient} />
            <View style={styles.fullScreenImageOverlay}>
              <View style={styles.propertyBadgeFullScreen}>
                <Ionicons name="home" size={18} color="#fff" />
                <Text style={styles.badgeTextFullScreen}>{selectedProperty.propertyType || 'Property'}</Text>
              </View>
            </View>
          </View>
          
          {/* Scrollable Content */}
          <ScrollView 
            style={styles.fullScreenContentScroll} 
            showsVerticalScrollIndicator={false}
            bounces={true}
          >
            {/* Property Header */}
            <View style={styles.fullScreenPropertyHeader}>
              <View style={styles.propertyTitleRow}>
                <View style={styles.propertyTitleContainer}>
                  <Text style={styles.fullScreenPropertyTitle}>{selectedProperty.name}</Text>
                  <View style={styles.propertyBadgeContainer}>
                    <View style={styles.propertyTypeBadge}>
                      <Ionicons name="home" size={14} color={COLORS.primary} />
                      <Text style={styles.propertyTypeText}>{selectedProperty.propertyType || 'Property'}</Text>
                    </View>
                  </View>
                </View>
                <TouchableOpacity style={styles.favoriteButtonLarge}>
                  <Ionicons name="heart-outline" size={28} color="#E91E63" />
                </TouchableOpacity>
              </View>
              
              <View style={styles.priceAndRatingContainer}>
                <View style={styles.fullScreenPriceContainer}>
                  <Text style={styles.fullScreenPrice}>₱{selectedProperty.price?.toLocaleString()}</Text>
                  <Text style={styles.fullScreenPriceLabel}>/month</Text>
                </View>
                <View style={styles.ratingContainer}>
                  <Ionicons name="star" size={16} color="#FFD700" />
                  <Text style={styles.ratingText}>4.8</Text>
                  <Text style={styles.reviewCount}>(124 reviews)</Text>
                </View>
              </View>
            </View>

            {/* Location Card */}
            <View style={styles.fullScreenLocationCard}>
              <View style={styles.locationHeader}>
                <Ionicons name="location" size={24} color={COLORS.primary} />
                <Text style={styles.locationTitle}>Location</Text>
              </View>
              <Text style={styles.fullScreenAddress}>{selectedProperty.location?.address}</Text>
              <View style={styles.locationActions}>
                <TouchableOpacity style={styles.locationActionButton}>
                  <Ionicons name="map-outline" size={18} color={COLORS.primary} />
                  <Text style={styles.locationActionText}>View on Map</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.locationActionButton}>
                  <Ionicons name="car-outline" size={18} color={COLORS.primary} />
                  <Text style={styles.locationActionText}>
                    {realDistance ? `${realDistance.toFixed(1)} km away` : '2.5 km away'}
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

            {/* Contact Information Card - Moved up */}
            <View style={styles.elegantContactCard}>
              <View style={styles.contactCardHeader}>
                <View style={styles.contactHeaderLeft}>
                  <Ionicons name="person-circle" size={28} color="#8B5CF6" />
                  <Text style={styles.elegantContactTitle}>Meet Your Host</Text>
                </View>
                <View style={styles.hostRatingBadge}>
                  <Ionicons name="star" size={14} color="#FFD700" />
                  <Text style={styles.hostRating}>5.0</Text>
                </View>
              </View>
              <View style={styles.elegantContactProfile}>
                <View style={styles.elegantContactAvatar}>
                  <Ionicons name="person" size={36} color="#fff" />
                  <View style={styles.onlineIndicator} />
                </View>
                <View style={styles.elegantContactInfo}>
                  <Text style={styles.elegantContactName}>Maria Santos</Text>
                  <Text style={styles.elegantContactRole}>Property Owner • Superhost</Text>
                  <View style={styles.hostStats}>
                    <View style={styles.hostStat}>
                      <Text style={styles.hostStatValue}>127</Text>
                      <Text style={styles.hostStatLabel}>Reviews</Text>
                    </View>
                    <View style={styles.hostStatDivider} />
                    <View style={styles.hostStat}>
                      <Text style={styles.hostStatValue}>3 yrs</Text>
                      <Text style={styles.hostStatLabel}>Hosting</Text>
                    </View>
                  </View>
                </View>
                <TouchableOpacity style={styles.elegantMessageButton}>
                  <Ionicons name="chatbubble-ellipses" size={22} color="#8B5CF6" />
                </TouchableOpacity>
              </View>
              <Text style={styles.hostDescription}>
                "Hi! I'm Maria, your local host. I'm passionate about providing comfortable stays and helping guests explore the best of our beautiful city."
              </Text>
            </View>

            {/* Features & Amenities Card - Moved down and enhanced */}
            <View style={styles.elegantFeaturesCard}>
              <View style={styles.featuresCardHeader}>
                <Ionicons name="sparkles" size={26} color="#8B5CF6" />
                <Text style={styles.elegantFeaturesTitle}>Premium Amenities</Text>
              </View>
              <View style={styles.elegantFeaturesGrid}>
                <View style={styles.elegantFeatureItem}>
                  <View style={styles.elegantFeatureIcon}>
                    <Ionicons name="bed" size={24} color="#8B5CF6" />
                  </View>
                  <Text style={styles.elegantFeatureTitle}>Luxury Furnishing</Text>
                  <Text style={styles.elegantFeatureDesc}>Premium furniture & decor</Text>
                </View>
                <View style={styles.elegantFeatureItem}>
                  <View style={styles.elegantFeatureIcon}>
                    <Ionicons name="wifi" size={24} color="#10B981" />
                  </View>
                  <Text style={styles.elegantFeatureTitle}>High-Speed WiFi</Text>
                  <Text style={styles.elegantFeatureDesc}>Fiber optic 500 Mbps</Text>
                </View>
                <View style={styles.elegantFeatureItem}>
                  <View style={styles.elegantFeatureIcon}>
                    <Ionicons name="car-sport" size={24} color="#F59E0B" />
                  </View>
                  <Text style={styles.elegantFeatureTitle}>Secure Parking</Text>
                  <Text style={styles.elegantFeatureDesc}>Covered garage space</Text>
                </View>
              </View>
              <View style={styles.additionalAmenities}>
                <Text style={styles.amenitiesTitle}>Additional Perks</Text>
                <View style={styles.amenitiesList}>
                  <View style={styles.amenityTag}>
                    <Ionicons name="shield-checkmark" size={16} color="#10B981" />
                    <Text style={styles.amenityText}>24/7 Security</Text>
                  </View>
                  <View style={styles.amenityTag}>
                    <Ionicons name="flash" size={16} color="#F59E0B" />
                    <Text style={styles.amenityText}>Backup Power</Text>
                  </View>
                  <View style={styles.amenityTag}>
                    <Ionicons name="fitness" size={16} color="#8B5CF6" />
                    <Text style={styles.amenityText}>Gym Access</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Bottom spacing for actions */}
            <View style={{ height: 180 }} />
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
              <Text style={styles.fullScreenNavigationText}>Get Directions</Text>
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
        </Animated.View>
      )}

      {/* Modern Refresh Button */}
      <TouchableOpacity 
        style={styles.refreshButton}
        onPress={() => setRefresh(!refresh)}
      >
        <Ionicons name="refresh" size={24} color="#fff" />
      </TouchableOpacity>

      {/* Distance & ETA Info Box */}
      {(distance || realDistance) && selectedProperty && (
        <BlurView intensity={80} tint="light" style={styles.infoBox}>
          <View style={styles.infoContent}>
            <Ionicons name="navigate" size={20} color={COLORS.primary} />
            <Text style={styles.infoText}>
              {distance ? `${distance.toFixed(2)} km • ${duration.toFixed(1)} mins` : `${realDistance.toFixed(1)} km direct`}
            </Text>
          </View>
        </BlurView>
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
    backgroundColor: '#fff',
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
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 16,
    background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.9), rgba(168, 85, 247, 0.8), rgba(147, 51, 234, 0.9))',
    backgroundColor: 'rgba(139, 92, 246, 0.85)',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  backButton: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  fullScreenHeaderTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  headerFavoriteButton: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  fullScreenImageContainer: {
    position: 'relative',
    height: 300,
    width: '100%',
  },
  fullScreenPropertyImage: {
    width: '100%',
    height: '100%',
  },
  fullScreenImageGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  fullScreenImageOverlay: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
  },
  propertyBadgeFullScreen: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 25,
    alignSelf: 'flex-start',
    backdropFilter: 'blur(10px)',
  },
  badgeTextFullScreen: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
    textTransform: 'capitalize',
  },
  fullScreenContentScroll: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  fullScreenPropertyHeader: {
    paddingTop: 32,
    paddingBottom: 24,
    paddingHorizontal: 4,
  },
  propertyTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  propertyTitleContainer: {
    flex: 1,
    paddingRight: 16,
  },
  fullScreenPropertyTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 8,
    lineHeight: 34,
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
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
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
  favoriteButtonLarge: {
    backgroundColor: '#FEF2F2',
    width: 52,
    height: 52,
    borderRadius: 26,
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
    fontSize: 32,
    fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: -1,
  },
  fullScreenPriceLabel: {
    fontSize: 16,
    color: '#6B7280',
    marginLeft: 8,
    fontWeight: '500',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FEF3C7',
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#92400E',
    marginLeft: 4,
  },
  reviewCount: {
    fontSize: 12,
    color: '#78716C',
    marginLeft: 4,
  },
  modernCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
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
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginLeft: 12,
    letterSpacing: -0.3,
  },
  fullScreenLocationCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
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
    marginBottom: 12,
  },
  locationTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginLeft: 12,
    letterSpacing: -0.3,
  },
  fullScreenAddress: {
    fontSize: 16,
    color: '#4B5563',
    lineHeight: 24,
    marginBottom: 16,
    fontWeight: '500',
  },
  locationActions: {
    flexDirection: 'row',
    gap: 12,
  },
  locationActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    flex: 1,
  },
  locationActionText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
    marginLeft: 8,
  },
  modernDescription: {
    fontSize: 16,
    color: '#4B5563',
    lineHeight: 26,
    fontWeight: '400',
    marginBottom: 16,
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
    borderRadius: 24,
    padding: 24,
    marginBottom: 20,
    marginHorizontal: 4,
    shadowColor: '#8B5CF6',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 24,
    elevation: 12,
    borderWidth: 1,
    borderColor: '#F8FAFC',
  },
  contactCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  contactHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  elegantContactTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    marginLeft: 12,
    letterSpacing: -0.4,
  },
  hostRatingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FEF3C7',
  },
  hostRating: {
    fontSize: 14,
    fontWeight: '700',
    color: '#92400E',
    marginLeft: 4,
  },
  elegantContactProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  elegantContactAvatar: {
    position: 'relative',
    backgroundColor: 'linear-gradient(135deg, #8B5CF6, #A855F7)',
    backgroundColor: '#8B5CF6',
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
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
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#10B981',
    borderWidth: 3,
    borderColor: '#fff',
  },
  elegantContactInfo: {
    flex: 1,
  },
  elegantContactName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  elegantContactRole: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
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
    fontSize: 15,
    color: '#4B5563',
    lineHeight: 22,
    fontStyle: 'italic',
    backgroundColor: '#F8FAFC',
    padding: 16,
    borderRadius: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#8B5CF6',
  },
  elegantFeaturesCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    marginBottom: 20,
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
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  elegantFeaturesTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    marginLeft: 12,
    letterSpacing: -0.4,
  },
  elegantFeaturesGrid: {
    gap: 16,
    marginBottom: 24,
  },
  elegantFeatureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAFBFC',
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#F1F3F4',
  },
  elegantFeatureIcon: {
    backgroundColor: '#fff',
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 3,
  },
  elegantFeatureTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
    flex: 1,
  },
  elegantFeatureDesc: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
    flex: 1,
  },
  additionalAmenities: {
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  amenitiesTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 12,
  },
  amenitiesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  amenityTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  amenityText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    marginLeft: 6,
  },
  fullScreenBottomActions: {
    position: 'absolute',
    bottom: 90, // Adjust for tab bar height
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    borderRadius: 20,
    marginHorizontal: 10,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: -4 },
    shadowRadius: 12,
    elevation: 10,
  },
  fullScreenActionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  fullScreenPrimaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 16,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 6,
  },
  fullScreenPrimaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  fullScreenSecondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 16,
  },
  fullScreenSecondaryButtonText: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  fullScreenNavigationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#8B5CF6',
    paddingVertical: 16,
    borderRadius: 16,
    shadowColor: '#8B5CF6',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 6,
  },
  fullScreenNavigationText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
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
});
