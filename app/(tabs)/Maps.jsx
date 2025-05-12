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

const MAPBOX_TOKEN = 'pk.eyJ1IjoiYWRyaWFuNTUxNyIsImEiOiJjbTlyMHpubjYxcG9lMmtwdDVtc3FtaXRxIn0.6Qx1Pf_dIOCfRB7n7tWl1g';
const directionsClient = MapboxDirections({ accessToken: MAPBOX_TOKEN });

const getImageUri = (property) => {
  console.log('Property images:', property?.images); // Debug log
  if (!property?.images?.length) return 'https://via.placeholder.com/400x300?text=No+Image';
  const path = property.images[0];
  if (!path) return 'https://via.placeholder.com/400x300?text=No+Image';
  const imageUrl = path.startsWith('http') ? path : `https://rentify-server-ge0f.onrender.com${path.startsWith('/') ? path : '/' + path}`;
  console.log('Image URL:', imageUrl); // Debug log
  return imageUrl;
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
          // Merge ML recommendations with full property data
          const enrichedData = mlData.map(mlItem => {
            // Find the complete property data
            const fullProperty = allProperties.find(p => p._id === mlItem._id);
            if (fullProperty) {
              return {
                ...fullProperty, // This includes all property data including images
                cluster: mlItem.cluster,
                location: fullProperty.location || mlItem.location
              };
            }
            return mlItem;
          });
          console.log('Enriched data:', enrichedData[0]); // Debug log
          setMlProperties(enrichedData);
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
        customMapStyle={[
          {
            "featureType": "all",
            "elementType": "geometry",
            "stylers": [{"color": "#f5f5f5"}]
          },
          {
            "featureType": "water",
            "elementType": "geometry",
            "stylers": [{"color": "#e9e9e9"}, {"lightness": 17}]
          },
          {
            "featureType": "road",
            "elementType": "geometry",
            "stylers": [{"color": "#ffffff"}]
          },
          {
            "featureType": "road.highway",
            "elementType": "geometry",
            "stylers": [{"color": "#fafafa"}]
          },
          {
            "featureType": "road.highway",
            "elementType": "geometry.stroke",
            "stylers": [{"color": "#f5f5f5"}]
          },
          {
            "featureType": "road.arterial",
            "elementType": "geometry",
            "stylers": [{"color": "#fafafa"}]
          },
          {
            "featureType": "road.local",
            "elementType": "geometry",
            "stylers": [{"color": "#ffffff"}]
          },
          {
            "featureType": "poi",
            "elementType": "geometry",
            "stylers": [{"color": "#f5f5f5"}]
          },
          {
            "featureType": "poi.park",
            "elementType": "geometry",
            "stylers": [{"color": "#dedede"}]
          },
          {
            "featureType": "poi.park",
            "elementType": "labels.text.fill",
            "stylers": [{"color": "#6b9a76"}]
          },
          {
            "featureType": "poi.business",
            "elementType": "geometry",
            "stylers": [{"color": "#f5f5f5"}]
          },
          {
            "featureType": "transit",
            "elementType": "geometry",
            "stylers": [{"color": "#f5f5f5"}]
          },
          {
            "featureType": "transit.station",
            "elementType": "geometry",
            "stylers": [{"color": "#dedede"}]
          },
          {
            "featureType": "administrative",
            "elementType": "geometry.stroke",
            "stylers": [{"color": "#bdbdbd"}]
          },
          {
            "featureType": "administrative.land_parcel",
            "elementType": "geometry.stroke",
            "stylers": [{"color": "#bdbdbd"}]
          },
          {
            "featureType": "administrative.locality",
            "elementType": "geometry.stroke",
            "stylers": [{"color": "#bdbdbd"}]
          },
          {
            "featureType": "landscape",
            "elementType": "geometry",
            "stylers": [{"color": "#f5f5f5"}]
          },
          {
            "featureType": "landscape.natural",
            "elementType": "geometry",
            "stylers": [{"color": "#f5f5f5"}]
          }
        ]}
      >
        {location && (
          <Marker
            coordinate={{
              latitude: location.latitude,
              longitude: location.longitude,
            }}
            image={Person}
          />
        )}

        {filteredProperties.map((property, index) => (
          property.location && (
            <Marker
              key={property._id || index}
              coordinate={{
                latitude: property.location.latitude,
                longitude: property.location.longitude,
              }}
              title={property.name}
              description={`₱${property.price} | ${property.propertyType || ''}`}
              pinColor={clusterColors[selectedCluster]}
              onPress={() => handlePropertySelect(property)}
            />
          )
        ))}

        {routeCoords.length > 0 && (
          <Polyline 
            coordinates={routeCoords} 
            strokeWidth={4} 
            strokeColor={COLORS.primary}
            lineDashPattern={[1]}
          />
        )}
      </MapView>

      {/* Property Card */}
      {selectedProperty && (
        <Animated.View 
          style={[
            styles.propertyCard,
            {
              transform: [{
                translateY: expandAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, -200]
                })
              }]
            }
          ]}
        >
          <TouchableOpacity style={styles.expandButton} onPress={toggleExpand}>
            <Ionicons 
              name={isExpanded ? "chevron-down" : "chevron-up"} 
              size={24} 
              color={COLORS.primary} 
            />
          </TouchableOpacity>
          
          <ScrollView style={styles.propertyCardScroll} showsVerticalScrollIndicator={false}>
            <View style={styles.propertyCardContent}>
              <Image
                source={{ uri: getImageUri(selectedProperty) }}
                style={styles.propertyImage}
                resizeMode="cover"
              />
              <View style={styles.propertyInfo}>
                <Text style={styles.propertyTitle}>{selectedProperty.name}</Text>
                <Text style={styles.propertyPrice}>₱{selectedProperty.price}/month</Text>
                <Text style={styles.propertyType}>{selectedProperty.propertyType || ''}</Text>
                <Text style={styles.propertyAddress}>{selectedProperty.location?.address}</Text>
                
                {isExpanded && (
                  <View style={styles.expandedInfo}>
                    <Text style={styles.description} numberOfLines={3}>{selectedProperty.description}</Text>
                    <View style={styles.sheetActions}>
                      <TouchableOpacity 
                        style={[styles.modernContactButton, { flex: 1, marginRight: 8 }]} 
                        onPress={() => alert(`Contact ${selectedProperty.postedBy || 'owner'}`)}
                      >
                        <Ionicons name="call-outline" size={20} color={COLORS.primary} style={{ marginRight: 8 }} />
                        <Text style={styles.modernContactButtonText}>Contact</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={[styles.modernRentButton, { flex: 1 }]} 
                        onPress={() => alert(`You chose to rent: ${selectedProperty.name}`)}
                      >
                        <Ionicons name="home-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
                        <Text style={styles.modernRentButtonText}>Rent</Text>
                      </TouchableOpacity>
                    </View>
                    <TouchableOpacity 
                      style={styles.navigationButton}
                      onPress={startNavigation}
                    >
                      <Ionicons name="navigate" size={24} color="#fff" style={{ marginRight: 8 }} />
                      <Text style={styles.navigationButtonText}>Get Directions</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          </ScrollView>
          
          <TouchableOpacity 
            style={styles.closeButton} 
            onPress={() => {
              setSelectedProperty(null);
              setIsExpanded(false);
            }}
          >
            <Ionicons name="close" size={20} color="#fff" />
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Navigation Modal */}
      {navigationMode && (
        <Animated.View 
          style={[
            styles.navigationModal,
            {
              transform: [{
                translateY: slideAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [300, 0]
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
              name={getDirectionIcon(routeSteps[currentStep].type, routeSteps[currentStep].modifier)} 
              size={32} 
              color={COLORS.primary} 
            />
            <View style={styles.stepInfo}>
              <Text style={styles.stepInstruction}>{routeSteps[currentStep].instruction}</Text>
              <Text style={styles.stepDistance}>
                {Math.round(routeSteps[currentStep].distance)}m • {Math.round(routeSteps[currentStep].duration)}s
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

      {/* Modern Refresh Button */}
      <TouchableOpacity 
        style={styles.refreshButton}
        onPress={() => setRefresh(!refresh)}
      >
        <Ionicons name="refresh" size={24} color="#fff" />
      </TouchableOpacity>

      {/* Distance & ETA Info Box */}
      {distance && duration && selectedProperty && (
        <BlurView intensity={80} tint="light" style={styles.infoBox}>
          <View style={styles.infoContent}>
            <Ionicons name="navigate" size={20} color={COLORS.primary} />
            <Text style={styles.infoText}>
              {distance.toFixed(2)} km • {duration.toFixed(1)} mins
            </Text>
          </View>
        </BlurView>
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
  propertyCard: {
    position: 'absolute',
    bottom: 80,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
    zIndex: 20,
    maxHeight: '70%',
  },
  propertyCardScroll: {
    flex: 1,
  },
  expandButton: {
    alignSelf: 'center',
    padding: 8,
    marginBottom: 8,
    backgroundColor: '#f8f8f8',
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  propertyCardContent: {
    flexDirection: 'row',
    paddingBottom: 16,
  },
  propertyImage: {
    width: 120,
    height: 120,
    borderRadius: 16,
    marginRight: 16,
  },
  propertyInfo: {
    flex: 1,
  },
  propertyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 4,
  },
  propertyPrice: {
    fontSize: 16,
    color: COLORS.primary,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  propertyType: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  propertyAddress: {
    fontSize: 13,
    color: '#999',
  },
  expandedInfo: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  description: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 12,
  },
  sheetActions: {
    marginTop: 12,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modernContactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: COLORS.primary,
    borderRadius: 20,
    paddingVertical: 10,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.13,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 3,
  },
  modernContactButtonText: {
    color: COLORS.primary,
    fontWeight: 'bold',
    fontSize: 14,
    letterSpacing: 0.3,
  },
  modernRentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    paddingVertical: 10,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 4,
  },
  modernRentButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
    letterSpacing: 0.3,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: COLORS.primary,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
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
  navigationModal: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 16,
    height: '85%',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    zIndex: 100,
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
