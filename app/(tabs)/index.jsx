import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, Image, TextInput, TouchableOpacity, Modal, StatusBar as RNStatusBar } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import COLORS from '../../constant/colors';
import Fuse from 'fuse.js';
import KMeans from 'ml-kmeans';

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

      {/* Top Box Buttons */}
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

      {/* Search box */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search room..."
          placeholderTextColor={COLORS.placeholderText}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <TouchableOpacity style={styles.searchButton}>
          <Ionicons name="search" size={24} color="white" />
        </TouchableOpacity>
      </View>

      {/* Category filter */}
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

      {/* Properties list */}
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
                  <Text style={styles.propertyLocation}>{property.location.address}</Text>
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

      {/* Modal for property details */}
      {selectedProperty && (
        <Modal
          animationType="slide"
          transparent={true}
          visible={modalVisible}
          onRequestClose={handleCloseModal}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
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
              <TouchableOpacity style={styles.contactButton}>
                <Text style={styles.contactButtonText}>Contact</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.contactButton}>
                <Text style={styles.contactButtonText}>Navigate</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    position: 'absolute',
    top: 15,
    left: 0,
    right: 0,
    padding: 15,
    backgroundColor: 'white',
    zIndex: 10,
  },
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
  filteredDataContainer: {
    paddingHorizontal: 10,
    marginTop: 20,
  },
    propertyCard: {
      marginBottom: 20,
      borderRadius: 12, // Rounded edges for a soft look
      overflow: 'hidden',
      backgroundColor: 'rgba(178, 212, 255, 0.3)', // Semi-transparent white background
      backdropFilter: 'blur(23px)', // Glass-like blur effect
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 10,
      elevation: 6, // Shadow effect for Android
      padding: 15, 
      margin:10,
      
    },
    propertyImage: {
      width: '100%',
      height: 180,
      borderRadius: 12,
    },
    propertyDetailsContainer: {
      
      paddingLeft:5, // Adjusted top padding to create space between image and content
    },
    propertyName: {
      fontSize: 20, // Increased font size for better readability
      fontWeight: 'bold',
      color: COLORS.primary,
      paddingTop:10,
      
      marginBottom: 5, // Space between name and price
    },
    propertyPrice: {
      fontSize: 18,
      color: COLORS.border,
      fontWeight: 'bold',
      marginBottom: 5, // Space between price and description
    },
    propertyDescription: {
      fontSize: 15,
      color: '#666',
       // Added space below description
      height: 45, // Adjusted height to better fit longer descriptions
      overflow: 'hidden', // Ensures long text is clipped
    },
    propertyLocation: {
      fontSize: 15,
      color: '#444',
      fontStyle: 'italic',
      marginBottom: 10, // Space before the button
    },
    propertyButton: {
      backgroundColor: COLORS.primary,
      paddingVertical: 12, // Increased padding for better button size
      alignItems: 'center',
      borderRadius: 14,
      marginBottom: 10,
    
    },
    propertyButtonText: {
      color: 'white',
      fontWeight: 'bold',
      fontSize: 16,
    },
    noResultsText: {
      textAlign: 'center',
      color: COLORS.primary,
      marginTop: 20,
      fontSize: 16,
    },
  
  modalContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { width: '90%', backgroundColor: 'white', borderRadius: 10, padding: 28, alignItems: 'center' },
  closeButton: { position: 'absolute', top: 10, right: 10 ,},
  modalImage: { width: '100%', height: 200, borderRadius: 10  },
  modalName: { fontSize: 22, fontWeight: 'bold', color: COLORS.primary, marginVertical: 10 },
  modalDescription: { fontSize: 16, color: '#666', textAlign: 'center', marginBottom: 10 },
  modalLocation: { fontSize: 14, color: '#333' },
  modalPrice: { fontSize: 16, color: COLORS.primary, marginVertical: 5 },
  modalStatus: { fontSize: 14, color: '#333', marginVertical: 5 },
  modalPostedBy: { fontSize: 14, color: '#333', marginVertical: 5 },
  modalAmenities: { fontSize: 14, color: '#333', marginVertical: 5 },
  contactButton: { backgroundColor: COLORS.primary, paddingVertical: 12, width: '100%', alignItems: 'center', marginVertical: 10, borderRadius: 8 },
  contactButtonText: { color: 'white', fontWeight: 'bold' },
});
