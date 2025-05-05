import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Image, TextInput,
  TouchableOpacity, Modal, StatusBar as RNStatusBar
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import COLORS from '../../constant/colors';
import Fuse from 'fuse.js';
import MapView, { Marker } from 'react-native-maps';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { router } from 'expo-router';
import { Dimensions } from 'react-native';

export default function Home() {
  const [username, setUsername] = useState('Guest');
  const [profilePicture, setProfilePicture] = useState('https://example.com/default-profile.png');
  const [searchQuery, setSearchQuery] = useState('');
  const [properties, setProperties] = useState([]);
  const [filteredProperties, setFilteredProperties] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const navigation = useNavigation();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const categories = ['All', 'Apartment', 'Condo', 'House', 'Dorm'];

  const fuseOptions = {
    keys: ['name', 'description', 'location.address', 'postedBy', 'amenities'],
    threshold: 0.3,
  };

  const loadUserDetails = async () => {
    try {
      const storedUsername = await AsyncStorage.getItem('username');
      const storedProfilePicture = await AsyncStorage.getItem('profilePicture');
      setUsername(storedUsername || 'Guest');
      setProfilePicture(storedProfilePicture?.startsWith('http') ? storedProfilePicture : 'https://example.com/default-profile.png');
    } catch (error) {
      console.error('Error loading user details:', error);
    }
  };

  const fetchProperties = async () => {
    try {
      const response = await fetch('https://rentify-server-ge0f.onrender.com/api/properties');
      const json = await response.json();
      if (Array.isArray(json)) {
        setProperties(json);
        setFilteredProperties(json);
      }
    } catch (error) {
      console.error('Error fetching properties:', error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadUserDetails();
      fetchProperties();
    }, [])
  );

  useEffect(() => {
    let filtered = properties;
    if (selectedCategory !== 'All') {
      filtered = filtered.filter(p => p.propertyType?.toLowerCase() === selectedCategory.toLowerCase());
    }
    if (searchQuery.trim() !== '') {
      const fuse = new Fuse(filtered, fuseOptions);
      filtered = fuse.search(searchQuery).map(r => r.item);
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
    setCurrentImageIndex(0);
  };

  const handleCreatePress = () => {
    navigation.navigate('CreateProperty');
  };

  const getImageUri = (property) => {
    if (property?.images?.length > 0) {
      const imagePath = property.images[0];
      if (imagePath.startsWith('http')) {
        return imagePath;
      } else {
        return `https://rentify-server-ge0f.onrender.com${imagePath.startsWith('/') ? imagePath : `/${imagePath}`}`;
      }
    }
    return 'https://picsum.photos/200/300';
  };

  return (
    <View style={[styles.container, { paddingTop: statusBarHeight }]}>
      <RNStatusBar barStyle="dark-content" backgroundColor={COLORS.white} />

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

      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.button} onPress={() => router.push('/(tabs)/Maps')}>
          <Ionicons name="location-sharp" size={24} color="white" />
          <Text style={styles.buttonText}>Nearby</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={handleCreatePress}>
          <Ionicons name="add-circle" size={24} color="white" />
          <Text style={styles.buttonText}>Create</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button}>
          <Ionicons name="home" size={24} color="white" />
          <Text style={styles.buttonText}>Property</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search room..."
          placeholderTextColor="#999"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <TouchableOpacity style={styles.searchButton}>
          <Ionicons name="search" size={24} color="white" />
        </TouchableOpacity>
      </View>

      <View style={styles.categoryWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {categories.map(category => (
            <TouchableOpacity
              key={category}
              onPress={() => setSelectedCategory(category)}
              style={[styles.categoryButton, selectedCategory === category && styles.categoryButtonActive]}
            >
              <Text style={[styles.categoryText, selectedCategory === category && styles.categoryTextActive]}>
                {category}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={{ ...styles.scrollContent, paddingBottom: 100 }}>
        <View style={styles.filteredDataContainer}>
          {filteredProperties.length > 0 ? (
            filteredProperties.map((property, index) => (
              <View key={property._id || index} style={styles.propertyCard}>
                <Image
                  source={{ uri: getImageUri(property) }}
                  style={styles.propertyImage}
                />
                <View style={styles.namePriceRow}>
                  <Text style={styles.propertyName}>{property.name}</Text>
                  <Text style={styles.propertyPrice}>₱{property.price} /month</Text>
                </View>
                <Text style={styles.propertyLocation}>{property.location?.address || 'Location not available'}</Text>
                <Text style={styles.propertyDescription}>{property.description}</Text>
                <TouchableOpacity style={styles.propertyButton} onPress={() => handlePropertyPress(property)}>
                  <Text style={styles.propertyButtonText}>View Details</Text>
                </TouchableOpacity>
              </View>
            ))
          ) : (
            <Text style={styles.noResultsText}>No properties found</Text>
          )}
        </View>
      </ScrollView>

      {selectedProperty && (
        <Modal animationType="slide" transparent visible={modalVisible} onRequestClose={handleCloseModal}>
          <View style={styles.modalContainer}>
            <ScrollView contentContainerStyle={styles.modalContent}>
              <TouchableOpacity style={styles.closeButton} onPress={handleCloseModal}>
                <Ionicons name="close" size={24} color={COLORS.primary} />
              </TouchableOpacity>

              <View style={styles.carouselWrapper}>
                <ScrollView
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  onScroll={e => {
                    const index = Math.round(
                      e.nativeEvent.contentOffset.x / Dimensions.get('window').width
                    );
                    setCurrentImageIndex(index);
                  }}
                  scrollEventThrottle={16}
                >
                  {selectedProperty.images?.map((img, idx) => (
                    <Image
                      key={idx}
                      source={{ uri: img }}
                      style={styles.modalImage}
                      resizeMode="cover"
                    />
                  ))}
                </ScrollView>

                {/* Dot Indicator */}
                <View style={styles.dotContainer}>
                  {selectedProperty.images?.map((_, idx) => (
                    <View
                      key={idx}
                      style={[
                        styles.dot,
                        currentImageIndex === idx && styles.activeDot,
                      ]}
                    />
                  ))}
                </View>
              </View>

              <Text style={styles.modalName}>{selectedProperty.name}</Text>
              <Text style={styles.modalDescription}>Description: {selectedProperty.description}</Text>
              <Text style={styles.modalLocation}>Location: {selectedProperty.location?.address || 'N/A'}</Text>
              <Text style={styles.modalPrice}>₱{selectedProperty.price}</Text>
              <Text style={styles.modalStatus}>Status: {selectedProperty.status}</Text>
              <Text style={styles.modalPostedBy}>Posted by: {selectedProperty.postedBy}</Text>
              <Text style={styles.modalAmenities}>
                Amenities: {Array.isArray(selectedProperty.amenities) ? selectedProperty.amenities.join(', ') : 'N/A'}
              </Text>

              <View style={styles.modalButtons}>
                <TouchableOpacity style={styles.contactButton}>
                  <Text style={styles.contactButtonText}>Contact</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.contactButton}>
                  <Text style={styles.contactButtonText}>Rent</Text>
                </TouchableOpacity>
              </View>

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
  namePriceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 10,
    marginTop: 10,
  },
  propertyImage: { width: '100%', height: 200 },
  propertyName: { fontSize: 20, fontWeight: 'bold', marginTop: 10,color: COLORS.primary , padding:5},
  propertyPrice: { fontSize: 16, fontWeight: '600', marginHorizontal: 10 , backgroundColor: 'rgba(248, 184, 8, 0.94)', marginVertical: 5, padding: 5, borderRadius: 8 , width: 100, textAlign: 'center' },
  propertyLocation: { marginHorizontal: 10, color: 'gray' },
  propertyDescription: { marginHorizontal: 10, marginVertical: 5, color: 'gray' },
  propertyButton: { margin: 10, backgroundColor: COLORS.primary, padding: 10, borderRadius: 8 },
  propertyButtonText: { color: 'white', fontWeight: 'bold', textAlign: 'center' },
  noResultsText: { textAlign: 'center', marginTop: 20, color: 'gray' },
  modalContainer: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)', paddingTop: 30 },
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
  carouselWrapper: {
    width: '100%',
    height: 250,
    alignItems: 'center',
  },
  
  modalImage: {
    width: Dimensions.get('window').width,
    height: 250,
    resizeMode: 'cover',
    
  },
  
  dotContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ccc',
    marginHorizontal: 4,
  },
  
  activeDot: {
    backgroundColor: COLORS.primary,
    width: 10,
    height: 10,
  },
});
