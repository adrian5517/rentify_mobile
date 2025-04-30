import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, Image, TextInput, TouchableOpacity, Modal, StatusBar as RNStatusBar } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import COLORS from '../../constant/colors';
import Fuse from 'fuse.js';
import MapView, { Marker } from 'react-native-maps'; // ADD THIS
import House from '../../assets/images/houseView.png';

export default function Home() {
  const [username, setUsername] = useState('Guest');
  const [profilePicture, setProfilePicture] = useState('https://example.com/default-profile.png');
  const [searchQuery, setSearchQuery] = useState('');
  const [properties, setProperties] = useState([]);
  const [filteredProperties, setFilteredProperties] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);

  const categories = ['All', 'Apartment', 'Condo', 'House', 'Dorm'];

  const fuseOptions = {
    keys: ['name', 'description', 'location.address', 'postedBy', 'amenities'],
    threshold: 0.3,
  };

  useEffect(() => {
    const loadUserDetails = async () => {
      try {
        const storedUsername = await AsyncStorage.getItem('username');
        const storedProfilePicture = await AsyncStorage.getItem('profilePicture');
        setUsername(storedUsername || 'Guest');
        setProfilePicture(
          storedProfilePicture && storedProfilePicture.startsWith('http')
            ? storedProfilePicture
            : 'https://example.com/default-profile.png'
        );
      } catch (error) {
        console.error('Error loading user details:', error);
      }
    };

    loadUserDetails();
    fetchProperties();
  }, []);

  const fetchProperties = async () => {
    try {
      const response = await fetch('https://rentify-server-ge0f.onrender.com/api/properties');
      const json = await response.json();
      if (json && Array.isArray(json)) {
        setProperties(json);
        setFilteredProperties(json);
      }
    } catch (error) {
      console.error('Error fetching properties:', error);
    }
  };

  useEffect(() => {
    let filtered = properties;

    if (selectedCategory !== 'All') {
      filtered = filtered.filter(
        (property) =>
          property.propertyType &&
          property.propertyType.toLowerCase() === selectedCategory.toLowerCase()
      );
    }

    if (searchQuery.trim() !== '') {
      const fuse = new Fuse(filtered, fuseOptions);
      const results = fuse.search(searchQuery);
      filtered = results.map(result => result.item);
    }

    setFilteredProperties(filtered);
  }, [searchQuery, selectedCategory, properties]);

  const statusBarHeight = RNStatusBar.currentHeight || 0;

  const handlePropertyPress = (property) => {
    setSelectedProperty(property);
    setModalVisible(true);
  };

  const handleCloseModal = () => {
    setModalVisible(false);
    setSelectedProperty(null);
  };

  return (
    <View style={[styles.container, { paddingTop: statusBarHeight }]}>
      <RNStatusBar barStyle="dark-content" backgroundColor={COLORS.white} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.welcomeText}>Welcome "{username}" 👋</Text>
        <View style={styles.headerRight}>
          <Ionicons name="notifications" size={24} color={COLORS.primary} />
          <Image
            source={{ uri: profilePicture }}
            style={styles.profileImage}
            onError={() => setProfilePicture('https://i.pravatar.cc/300')}
          />
        </View>
      </View>

      {/* Top Buttons */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.button}>
          <Ionicons name="location-sharp" size={24} color="white" />
          <Text style={styles.buttonText}>Nearby</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button}>
          <Ionicons name="add-circle" size={24} color="white" />
          <Text style={styles.buttonText}>Create</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button}>
          <Ionicons name="home" size={24} color="white" />
          <Text style={styles.buttonText}>Property</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search room..."        
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <TouchableOpacity style={styles.searchButton}>
          <Ionicons name="search" size={24} color="white" />
        </TouchableOpacity>
      </View>

      {/* Categories */}
      <View style={styles.categoryWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {categories.map((category) => (
            <TouchableOpacity
              key={category}
              onPress={() => setSelectedCategory(category)}
              style={[styles.categoryButton, selectedCategory === category && styles.categoryButtonActive]}
            >
              <Text
                style={[styles.categoryText, selectedCategory === category && styles.categoryTextActive]}
              >
                {category}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Properties */}
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.filteredDataContainer}>
          {filteredProperties.length > 0 ? (
            filteredProperties.map((property, index) => {
              if (!property || !property.image) return null;
              return (
                <View key={index} style={styles.propertyCard}>
                  <Image source={{ uri: property.image }} style={styles.propertyImage} />
                  <Text style={styles.propertyName}>{property.name}</Text>
                  <Text style={styles.propertyPrice}>₱{property.price}</Text>
                  <Text style={styles.propertyLocation}>{property.location?.address || ''}</Text>
                  <Text style={styles.propertyDescription}>{property.description}</Text>
                  
                  <TouchableOpacity style={styles.propertyButton} onPress={() => handlePropertyPress(property)}>
                    <Text style={styles.propertyButtonText}>View Details</Text>
                  </TouchableOpacity>
                </View>
              );
            })
          ) : (
            <Text style={styles.noResultsText}>No properties found</Text>
          )}
        </View>
      </ScrollView>

      {/* Modal */}
      {selectedProperty && (
        <Modal
          animationType="slide"
          transparent={true}
          visible={modalVisible}
          onRequestClose={handleCloseModal}
        >
          <View style={styles.modalContainer}>
            <ScrollView contentContainerStyle={styles.modalContent}>
              <TouchableOpacity style={styles.closeButton} onPress={handleCloseModal}>
                <Ionicons name="close" size={24} color={COLORS.primary} />
              </TouchableOpacity>
              <Image source={{ uri: selectedProperty.image }} style={styles.modalImage} />
              <Text style={styles.modalName}>{selectedProperty.name}</Text>
              <Text style={styles.modalDescription}>{selectedProperty.description}</Text>
              <Text style={styles.modalLocation}>Location: {selectedProperty.location?.address || 'N/A'}</Text>
              <Text style={styles.modalPrice}>₱{selectedProperty.price}</Text>
              <Text style={styles.modalStatus}>Status: {selectedProperty.status}</Text>
              <Text style={styles.modalPostedBy}>Posted by: {selectedProperty.postedBy}</Text>
              <Text style={styles.modalAmenities}>Amenities: {selectedProperty.amenities.join(', ')}</Text>

              {/* Contact & Rent Buttons */}
              <View style={styles.modalButtons}>
                <TouchableOpacity style={styles.contactButton}>
                  <Text style={styles.contactButtonText}>Contact</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.contactButton}>
                  <Text style={styles.contactButtonText}>Rent</Text>
                </TouchableOpacity>
              </View>

              {/* Map */}
              {selectedProperty.location?.latitude && selectedProperty.location?.longitude && (
                <MapView
                  style={styles.map}
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
                    title={selectedProperty.name}
                    image={House}
                    description={selectedProperty.location.address}
                  />
                </MapView>
              )}
            </ScrollView>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', position: 'absolute', top: 15, left: 0, right: 0, padding: 15, backgroundColor: 'white', zIndex: 10 },
  welcomeText: { flex: 1, fontSize: 20, fontWeight: 'bold', color: COLORS.primary, paddingLeft: 10 },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  profileImage: { width: 50, height: 50, borderRadius: 40, borderWidth: 0.5, borderColor: COLORS.primary, marginLeft: 10 },
  buttonContainer: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 100, marginBottom: 20, paddingHorizontal: 10 },
  button: { backgroundColor: COLORS.primary, paddingVertical: 12, paddingHorizontal: 18, borderRadius: 10, alignItems: 'center', width: '28%' },
  buttonText: { marginTop: 5, color: 'white', fontSize: 14, fontWeight: 'bold' },
  searchContainer: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20 },
  searchInput: { flex: 1, borderWidth: 1, borderColor: COLORS.primary, borderRadius: 8, padding: 12, fontSize: 16, marginRight: 10 },
  searchButton: { backgroundColor: COLORS.primary, borderRadius: 8, padding: 10 },
  categoryWrapper: { height: 50, marginTop: 10, paddingHorizontal: 20 },
  categoryButton: { paddingVertical: 8, paddingHorizontal: 16, backgroundColor: '#f0f0f0', borderRadius: 20, marginRight: 10, alignSelf: 'center' },
  categoryButtonActive: { backgroundColor: COLORS.primary },
  categoryText: { fontWeight: 'bold', color: '#333' },
  categoryTextActive: { color: 'white' },
  filteredDataContainer: { paddingHorizontal: 10, marginTop: 20 },
  propertyCard: { marginBottom: 20, borderRadius: 12, overflow: 'hidden', backgroundColor: 'rgba(178, 212, 255, 0.3)',margin:15, },
  propertyImage: { width: '100%', height: 200 },
  propertyName: { fontSize: 20, fontWeight: 'bold', marginTop: 10, marginHorizontal: 10 ,color: COLORS.primary },
  propertyPrice: { fontSize: 16, fontWeight: '600', marginHorizontal: 10 },
  propertyLocation: { marginHorizontal: 10, color: 'gray' },
  propertyDescription: { marginHorizontal: 10, marginVertical: 5, color: 'gray' },
  propertyButton: { margin: 10, backgroundColor: COLORS.primary, padding: 10, borderRadius: 8 },
  propertyButtonText: { color: 'white', fontWeight: 'bold', textAlign: 'center' },
  noResultsText: { textAlign: 'center', marginTop: 20, color: 'gray' },
  modalContainer: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)', top:30, },
  modalContent: { backgroundColor: 'white', margin: 20, borderRadius: 10, padding: 15 },
  closeButton: { alignSelf: 'flex-end' },
  modalImage: { width: '100%', height: 200, borderRadius: 10 },
  modalName: { fontSize: 24, fontWeight: 'bold', marginTop: 10 },
  modalDescription: { marginTop: 10 },
  modalLocation: { marginTop: 5 },
  modalPrice: { marginTop: 5 },
  modalStatus: { marginTop: 5 },
  modalPostedBy: { marginTop: 5 },
  modalAmenities: { marginTop: 5 },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 15 },
  contactButton: { backgroundColor: COLORS.primary, flex: 1, marginHorizontal: 5, padding: 10, borderRadius: 8 },
  contactButtonText: { color: 'white', textAlign: 'center', fontWeight: 'bold' },
  map: { width: '100%', height: 250, marginTop: 20, borderRadius: 10 },
});
