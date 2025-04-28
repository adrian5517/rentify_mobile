import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, View, Alert, Text, Button } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import MapboxDirections from '@mapbox/mapbox-sdk/services/directions';
import { BlurView } from 'expo-blur';
import House from '../../assets/images/houseView.png';

const Person = require('../../assets/images/personView.png');

const MAPBOX_TOKEN = 'pk.eyJ1IjoiYWRyaWFuNTUxNyIsImEiOiJjbTlyMHpubjYxcG9lMmtwdDVtc3FtaXRxIn0.6Qx1Pf_dIOCfRB7n7tWl1g';
const directionsClient = MapboxDirections({ accessToken: MAPBOX_TOKEN });

export default function Create() {
  const [location, setLocation] = useState(null);
  const [properties, setProperties] = useState([]); // <-- now fetching properties
  const [routeCoords, setRouteCoords] = useState([]);
  const [distance, setDistance] = useState(null);
  const [duration, setDuration] = useState(null);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [isLocationPermissionGranted, setIsLocationPermissionGranted] = useState(false);
  const [refresh, setRefresh] = useState(false);
  const mapRef = useRef(null);

  // 1. Request permission and get current location
  useEffect(() => {
    const requestLocationPermission = async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location permission is required');
        return;
      }

      setIsLocationPermissionGranted(true);
      let loc = await Location.getCurrentPositionAsync({});
      setLocation(loc.coords);
    };

    requestLocationPermission();
  }, [refresh]);

  // 2. Fetch properties from API
  useEffect(() => {
    const fetchProperties = async () => {
      try {
        const response = await fetch('https://rentify-server-ge0f.onrender.com/api/properties'); // <-- change your endpoint
        const data = await response.json();
        setProperties(data);
      } catch (error) {
        console.error('Failed to fetch properties:', error);
      }
    };

    fetchProperties();
  }, [refresh]);

  // 3. Get route from current location to selected property
  useEffect(() => {
    const fetchDirections = async () => {
      if (selectedProperty && location) {
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
        const geometry = route.geometry;

        const coords = geometry.coordinates.map(([lon, lat]) => ({
          latitude: lat,
          longitude: lon,
        }));

        setRouteCoords(coords);
        setDistance(route.distance / 1000); // meters to km
        setDuration(route.duration / 60); // seconds to minutes

        if (mapRef.current) {
          mapRef.current.animateToRegion({
            latitude: selectedProperty.location.latitude,
            longitude: selectedProperty.location.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          });
        }
      }
    };

    fetchDirections();
  }, [selectedProperty, location, refresh]);

  return (
    <View style={styles.container}>
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
        {/* User marker */}
        {location && (
          <Marker
            coordinate={{
              latitude: location.latitude,
              longitude: location.longitude,
            }}
            
            image={Person}
          />
        )}

        {/* Property Markers */}
        {properties.map((property, index) => (
          <Marker
            key={property._id || index}
            coordinate={{
              latitude: property.location.latitude,
              longitude: property.location.longitude,
            }}
            title={property.name}
            description={`🏠 ${property.price}\n💵 ${property.propertyType}\n📍 ${property.location.address}`}
            pinColor="blue"
            image={House}
            onPress={() => setSelectedProperty(property)}
            
          />
        ))}

        {/* Route line */}
        {routeCoords.length > 0 && (
          <Polyline coordinates={routeCoords} strokeWidth={4} strokeColor="blue" />
        )}
      </MapView>

      {/* Distance & ETA Info */}
      {distance && duration && selectedProperty && (
        <BlurView intensity={50} tint="light" style={styles.infoBox}>
        <Text style={styles.infoText}>
          Distance to {selectedProperty.name}: {distance.toFixed(2)} km | ETA: {duration.toFixed(1)} mins
          ₱{selectedProperty.price}
        </Text>
      </BlurView>
      )}

      {/* Refresh Button */}
      <Button title="Refresh Map" onPress={() => setRefresh(!refresh)} />

      {/* Permission Fallback */}
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
  },
  infoText: {
    fontSize: 16,
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
