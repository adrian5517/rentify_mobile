import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Image, TextInput,
  TouchableOpacity, Modal, StatusBar, Dimensions
} from 'react-native';
import { useAuthStore } from '../../store/authStore';
import { Ionicons } from '@expo/vector-icons';
import COLORS from '../../constant/colors';
import Fuse from 'fuse.js';
import MapView, { Marker } from 'react-native-maps';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';
import { FlatList, PanResponder, Animated } from 'react-native';
import { ActivityIndicator } from 'react-native';
import propertyService from '../../services/propertyService';

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
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const navigation = useNavigation();
  // Always use KNN for recommendations
  const algo = 'knn';
  const [loadingML, setLoadingML] = useState(false);
  

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

  useFocusEffect(useCallback(() => {
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
    return path.startsWith('http') ? path : `https://rentify-server-ge0f.onrender.com${path.startsWith('/') ? path : '/' + path}`;
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

      
      <FlatList
        data={showML ? mlRecommended : filteredProperties}
        keyExtractor={(item, index) => {
          // Prefer _id, then id, then fallback to index
          const key = item._id?.toString() || item.id?.toString() || `item-${index}`;
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
            {...panResponder.panHandlers}
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
                        <Text style={styles.hostName}>{selectedProperty.postedBy || 'Property Owner'}</Text>
                        <Text style={styles.hostTitle}>Verified Host</Text>
                        <View style={styles.hostRating}>
                          <Ionicons name="star" size={14} color="#FFD700" />
                          <Text style={styles.hostRatingText}>4.9 (127 reviews)</Text>
                        </View>
                      </View>
                      <TouchableOpacity style={styles.hostMessageIcon}>
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

                  {/* Quick Actions */}
                  <View style={styles.quickActionsContainer}>
                    <Text style={styles.quickActionsTitle}>Get in Touch</Text>
                    <View style={styles.quickActionsRow}>
                      <TouchableOpacity 
                        style={styles.quickActionCard}
                        onPress={() => alert(`Calling ${selectedProperty.postedBy || 'owner'}`)}
                      >
                        <View style={styles.quickActionIcon}>
                          <Ionicons name="call" size={22} color="#10B981" />
                        </View>
                        <Text style={styles.quickActionText}>Call</Text>
                      </TouchableOpacity>
                      
                      <TouchableOpacity 
                        style={styles.quickActionCard}
                        onPress={() => alert(`Messaging ${selectedProperty.postedBy || 'owner'}`)}
                      >
                        <View style={styles.quickActionIcon}>
                          <Ionicons name="chatbubble" size={22} color="#3B82F6" />
                        </View>
                        <Text style={styles.quickActionText}>Message</Text>
                      </TouchableOpacity>
                      
                      <TouchableOpacity 
                        style={styles.quickActionCard}
                        onPress={() => alert('Opening email client...')}
                      >
                        <View style={styles.quickActionIcon}>
                          <Ionicons name="mail" size={22} color="#F59E0B" />
                        </View>
                        <Text style={styles.quickActionText}>Email</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Primary Action Buttons */}
                  <View style={styles.primaryActionsContainer}>
                    <TouchableOpacity 
                      style={styles.modernScheduleButton}
                      onPress={() => alert('Schedule a viewing...')}
                    >
                      <Ionicons name="calendar-outline" size={20} color={COLORS.primary} />
                      <Text style={styles.modernScheduleButtonText}>Schedule Viewing</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={styles.modernRentButton}
                      onPress={() => alert(`You chose to rent: ${selectedProperty.name}`)}
                    >
                      <Ionicons name="checkmark-circle" size={20} color="#fff" />
                      <Text style={styles.modernRentButtonText}>Apply Now</Text>
                    </TouchableOpacity>
                  </View>
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
});