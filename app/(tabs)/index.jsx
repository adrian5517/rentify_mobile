import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Image, TextInput,
  TouchableOpacity, Modal, StatusBar, Dimensions
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import COLORS from '../../constant/colors';
import Fuse from 'fuse.js';
import MapView, { Marker } from 'react-native-maps';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';
import { FlatList, PanResponder, Animated } from 'react-native';
import { ActivityIndicator } from 'react-native';

export default function Home() {
  // For slide down to close
  const slideAnim = React.useRef(new Animated.Value(0)).current;
  const panResponder = React.useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (evt, gestureState) => Math.abs(gestureState.dy) > 10,
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

  const [username, setUsername] = useState('Guest');
  const [profilePicture, setProfilePicture] = useState('https://example.com/default-profile.png');
  const [searchQuery, setSearchQuery] = useState('');
  const [properties, setProperties] = useState([]);
  const [filteredProperties, setFilteredProperties] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [mlRecommended, setMlRecommended] = useState([]);
  const [showML, setShowML] = useState(false);
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const navigation = useNavigation();
  const [algo, setAlgo] = useState('knn'); // 'knn' or 'kmeans'
  const [loadingML, setLoadingML] = useState(false);
  

  const categories = ['All', 'Apartment', 'Boarding House', 'House', 'Dorm'];

  const fuseOptions = {
    keys: ['name', 'description', 'location.address', 'postedBy', 'amenities'],
    threshold: 0.3,
  };

  const loadUserDetails = async () => {
    const storedUsername = await AsyncStorage.getItem('username');
    const storedProfilePicture = await AsyncStorage.getItem('profilePicture');
    setUsername(storedUsername || 'Guest');
    setProfilePicture(storedProfilePicture?.startsWith('http') ? storedProfilePicture : 'https://example.com/default-profile.png');
  };

  const fetchProperties = async () => {
    const res = await fetch('https://rentify-server-ge0f.onrender.com/api/properties');
    const data = await res.json();
    if (Array.isArray(data)) {
      setProperties(data);
      setFilteredProperties(data);
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
    // Use minPrice or maxPrice, fallback to 2000 if not set
    let price = minPrice ? parseInt(minPrice) : (maxPrice ? parseInt(maxPrice) : 2000);
    const res = await fetch('https://ml-rentify.onrender.com/ml', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: algo, price, ...location.coords }),
    });
    const data = await res.json();
    if (Array.isArray(data)) {
      setMlRecommended(data);
      setShowML(true);
    }
    setLoadingML(false);
  };

  useFocusEffect(useCallback(() => {
    loadUserDetails();
    fetchProperties();
  }, []));

  useEffect(() => {
    let filtered = [...properties];
    if (selectedCategory !== 'All')
      filtered = filtered.filter(p => p.propertyType?.toLowerCase() === selectedCategory.toLowerCase());
    if (searchQuery.trim() !== '') {
      const fuse = new Fuse(filtered, fuseOptions);
      filtered = fuse.search(searchQuery).map(r => r.item);
    }
    if (minPrice) filtered = filtered.filter(p => p.price >= parseInt(minPrice));
    if (maxPrice) filtered = filtered.filter(p => p.price <= parseInt(maxPrice));
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
    const path = property?.images?.[0];
    return path?.startsWith('http') ? path : `https://rentify-server-ge0f.onrender.com${path?.startsWith('/') ? path : '/' + path}`;
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

  return (
    <View style={styles.container}>
      <StatusBar hidden />

      {/* Modern Airbnb-style Header */}
      <View style={styles.airbnbHeader}>
        <View style={styles.headerLeft}>
          <Text style={styles.airbnbTitle}>Rentify</Text>
          <Text style={styles.airbnbSubtitle}>Find your next stay</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('Profile')}>
          <Image source={{ uri: profilePicture }} style={styles.profileImageLarge} />
        </TouchableOpacity>
      </View>

      {/* Algorithm Selection Chips */}
      <View style={styles.chipRow}>
        <TouchableOpacity
          style={[styles.chip, algo === 'knn' && styles.chipActive]}
          onPress={() => setAlgo('knn')}
          accessibilityLabel="Select KNN recommendation algorithm"
        >
          <Text style={[styles.chipText, algo === 'knn' && styles.chipTextActive]}>KNN</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.chip, algo === 'kmeans' && styles.chipActive]}
          onPress={() => setAlgo('kmeans')}
          accessibilityLabel="Select KMeans recommendation algorithm"
        >
          <Text style={[styles.chipText, algo === 'kmeans' && styles.chipTextActive]}>KMeans</Text>
        </TouchableOpacity>
      </View>

      {/* Modern Search Bar with Location Picker */}
      {/* Modern Search Bar with Location Picker */}
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

      {/* Price Filter Row */}
      {/* Price Filter Row */}
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
          onPress={fetchMLRecommendations}
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
            {loadingML ? 'Loading...' : (showML ? 'Recommended' : 'AI Suggest')}
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

      {/* Property Grid/List */}
      {/* Property Grid/List */}
      <FlatList
        data={showML ? mlRecommended : filteredProperties}
        keyExtractor={item => item._id?.toString() || item.id?.toString()}
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
            {...panResponder.panHandlers}
          >
            <TouchableOpacity onPress={handleCloseModal} style={styles.sheetCloseBtn} accessibilityLabel="Close property details">
              <Ionicons name="close" size={28} color={COLORS.primary} />
            </TouchableOpacity>
            {selectedProperty && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
                  {selectedProperty.images?.map((img, i) => (
                    <Image
                      key={i}
                      source={{ uri: getImageUri({ images: [img] }) }}
                      style={styles.sheetImage}
                    />
                  ))}
                </ScrollView>
                <Text style={styles.sheetTitle}>{selectedProperty.name}</Text>
                <Text style={styles.sheetPrice}>₱{selectedProperty.price}/month</Text>
                <Text style={styles.sheetLocation}>{selectedProperty.location?.address}</Text>
                <Text style={styles.sheetDescription}>{selectedProperty.description}</Text>
                {selectedProperty.amenities && (
                  <View style={styles.amenitiesContainer}>
                    <Text style={styles.amenitiesTitle}>Amenities:</Text>
                    {selectedProperty.amenities.map((item, index) => (
                      <Text key={index} style={styles.amenityItem}>• {item}</Text>
                    ))}
                  </View>
                )}
                <View style={styles.sheetActions}>
                  <TouchableOpacity style={styles.modernContactButton} onPress={() => alert(`Contact ${selectedProperty.postedBy || 'owner'}`)}>
                    <Text style={styles.modernContactButtonText}>Contact</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.modernRentButton} onPress={() => alert(`You chose to rent: ${selectedProperty.name}`)}>
                    <Text style={styles.modernRentButtonText}>Rent</Text>
                  </TouchableOpacity>
                </View>

                {/* Map with Pin */}
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

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f6f6fa', // soft background
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
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 18,
    minHeight: 420,
    elevation: 16,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: -2 },
    shadowRadius: 24,
    alignItems: 'center',
  },
  sheetCloseBtn: {
    alignSelf: 'center',
    marginBottom: 10,
    backgroundColor: '#e1e1e1',
    borderRadius: 20,
    padding: 8,
    marginTop: 6,
  },
  sheetImage: {
    width: Dimensions.get('window').width - 36,
    height: 210,
    borderRadius: 22,
    marginBottom: 12,
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
  sheetActions: {
    marginTop: 16,
    marginBottom: 20,
  },
  // --- MODERN MODAL BUTTONS ---
  modernContactButton: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: COLORS.primary,
    borderRadius: 24,
    paddingVertical: 15,
    marginBottom: 12,
    alignItems: 'center',
    width: '100%',
    shadowColor: COLORS.primary,
    shadowOpacity: 0.13,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 3,
  },
  modernContactButtonText: {
    color: COLORS.primary,
    fontWeight: 'bold',
    fontSize: 18,
    letterSpacing: 0.3,
  },
  modernRentButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 24,
    paddingVertical: 15,
    alignItems: 'center',
    width: '100%',
    marginTop: 6,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 4,
  },
  modernRentButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18,
    letterSpacing: 0.3,
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

  
  
  amenitiesContainer: {
    marginVertical: 10,
  },
  
  amenitiesTitle: {
    fontWeight: 'bold',
    marginBottom: 4,
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
});