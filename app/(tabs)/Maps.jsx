import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, View, Alert, Text, TouchableOpacity, Image, ScrollView } from 'react-native';

import MapView, { Marker, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import MapboxDirections from '@mapbox/mapbox-sdk/services/directions';
import { BlurView } from 'expo-blur';

// Use require for consistent asset loading

const Person = require('../../assets/images/personView.png');
const House = require('../../assets/images/houseView.png');

const MAPBOX_TOKEN = 'pk.eyJ1IjoiYWRyaWFuNTUxNyIsImEiOiJjbTlyMHpubjYxcG9lMmtwdDVtc3FtaXRxIn0.6Qx1Pf_dIOCfRB7n7tWl1g';
const directionsClient = MapboxDirections({ accessToken: MAPBOX_TOKEN });

const getImageUri = (property) => {
  const path = property?.images?.[0];
  return path?.startsWith('http') ? path : `https://rentify-server-ge0f.onrender.com${path?.startsWith('/') ? path : '/' + path}`;
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
  const [selectedCluster, setSelectedCluster] = useState(0); // 0: Low, 1: Mid, 2: High
  const [loadingML, setLoadingML] = useState(false);
  const mapRef = useRef(null);

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
        const res = await fetch('https://ml-rentify.onrender.com/ml', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'kmeans', price, ...location.coords }),
        });
        const data = await res.json();
        if (Array.isArray(data)) setMlProperties(data);
      } catch (error) {
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

  return (
    <View style={styles.container}>
      {/* Cluster Filter Buttons */}
      <View style={styles.clusterButtonRow}>
        {clusterNames.map((name, idx) => (
          <TouchableOpacity
            key={name}
            style={[styles.clusterButton, selectedCluster === idx && { backgroundColor: clusterColors[idx], elevation: 5 }]}
            onPress={() => setSelectedCluster(idx)}
            activeOpacity={0.85}
          >
            <Text style={[styles.clusterButtonText, selectedCluster === idx && { color: '#fff' }]}>{name}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Loading indicator */}
      {loadingML && (
        <View style={{ position: 'absolute', top: '50%', left: '50%', zIndex: 99, marginLeft: -50, marginTop: -30, backgroundColor: 'rgba(0,0,0,0.5)', padding: 20, borderRadius: 10 }}>
          <Text style={{ color: '#fff', fontWeight: 'bold' }}>Loading clusters...</Text>
        </View>
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
        initialRegion={{
          latitude: 13.6218,
          longitude: 123.1948,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
        showsUserLocation={true}
        showsMyLocationButton={true}
        zoomEnabled={true}
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
              onPress={() => setSelectedProperty(property)}
            />
          )
        ))}

        {routeCoords.length > 0 && (
          <Polyline coordinates={routeCoords} strokeWidth={4} strokeColor="blue" />
        )}
      </MapView>

      {/* Distance & ETA always visible at top */}
      {distance && duration && selectedProperty && (
        <BlurView intensity={50} tint="light" style={styles.infoBoxTop}>
          <Text style={styles.infoText}>
            Distance to {selectedProperty.name}: {distance.toFixed(2)} km | ETA: {duration.toFixed(1)} mins
          </Text>
        </BlurView>
      )}

      {/* Modern Property Card Overlay with Real Image */}
      {selectedProperty && (
        <View style={styles.propertyCardSmall}>
          <Image
            source={selectedProperty?.images && selectedProperty.images[0]
              ? { uri: getImageUri(selectedProperty) }
              : require('../../assets/images/houseView.png')}
            style={styles.propertyImageSmall}
            resizeMode="cover"
          />
          <View style={styles.propertyInfoSmall}>
            <Text style={styles.propertyTitle}>{selectedProperty.name}</Text>
            <Text style={styles.propertyPrice}>₱{selectedProperty.price}</Text>
            <Text style={styles.propertyType}>{selectedProperty.propertyType || ''}</Text>
            <Text style={styles.propertyAddress}>{selectedProperty.location?.address}</Text>
          </View>
          <TouchableOpacity style={styles.closeButtonModern} onPress={() => setSelectedProperty(null)}>
            <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 20 }}>×</Text>
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity style={styles.refreshButton} onPress={() => setRefresh(!refresh)}>
        <Text style={styles.refreshButtonText}>⟳ Refresh Map</Text>
      </TouchableOpacity>

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
  infoBoxTop: {
    position: 'absolute',
    top: 110,
    alignSelf: 'center',
    width: '90%',
    padding: 16,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    backgroundColor: 'rgba(0,0,0,0.4)',
    zIndex: 20,
  },
  clusterButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginTop: 50,
    marginBottom: 8,
    zIndex: 10,
    position: 'absolute',
    width: '100%',
    paddingHorizontal: 8,
  },
  clusterButton: {
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 18,
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
    fontWeight: 'bold',
    fontSize: 15,
  },
  propertyCardSmall: {
    position: 'absolute',
    bottom: 110,
    left: 20,
    right: 20,
    backgroundColor: '#fff',
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    zIndex: 20,
    overflow: 'hidden',
  },
  propertyImageSmall: {
    width: 64,
    height: 64,
    borderRadius: 12,
    marginRight: 14,
    backgroundColor: '#eee',
  },
  propertyInfoSmall: {
    flex: 1,
  },

  closeButtonModern: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#E91E63',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    zIndex: 30,
  },

  propertyInfo: {
    flex: 1,
  },
  propertyTitle: {
    fontWeight: 'bold',
    fontSize: 16,
    color: '#222',
  },
  propertyPrice: {
    fontSize: 15,
    color: '#4CAF50',
    fontWeight: 'bold',
    marginTop: 2,
  },
  propertyType: {
    fontSize: 13,
    color: '#757575',
    marginTop: 2,
  },
  propertyAddress: {
    fontSize: 12,
    color: '#aaa',
    marginTop: 2,
  },
  closeButton: {
    backgroundColor: '#E91E63',
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
    elevation: 2,
  },
  refreshButton: {
    position: 'absolute',
    bottom: 38,
    right: 20,
    backgroundColor: '#222',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 18,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  refreshButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  infoBox: {
    position: 'absolute',
    bottom: 100,
    alignSelf: 'center',
    width: '90%',
    padding: 16,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  infoText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: 'white',
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
});
