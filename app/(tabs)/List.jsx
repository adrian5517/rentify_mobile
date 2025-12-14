import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, Image, TextInput,
  TouchableOpacity, FlatList, StatusBar, Animated
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import COLORS from '../../constant/colors';
import Fuse from 'fuse.js';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function List() {
  const navigation = useNavigation();
  const [searchQuery, setSearchQuery] = useState('');
  const [properties, setProperties] = useState([]);
  const [filteredProperties, setFilteredProperties] = useState([]);
  const [sortBy, setSortBy] = useState('price');
  const [sortOrder, setSortOrder] = useState('asc');
  const [favorites, setFavorites] = useState([]);
  const [showFavorites, setShowFavorites] = useState(false);

  const fetchProperties = async () => {
    try {
      const res = await fetch('https://rentify-server-ge0f.onrender.com/api/properties');
      const data = await res.json();
      if (Array.isArray(data)) {
        setProperties(data);
        setFilteredProperties(data);
      }
    } catch (error) {
      console.error('Failed to fetch properties:', error);
    }
  };

  const loadFavorites = async () => {
    try {
      const storedFavorites = await AsyncStorage.getItem('favorites');
      if (storedFavorites) {
        setFavorites(JSON.parse(storedFavorites));
      }
    } catch (error) {
      console.error('Failed to load favorites:', error);
    }
  };

  const toggleFavorite = async (propertyId) => {
    try {
      const newFavorites = favorites.includes(propertyId)
        ? favorites.filter(id => id !== propertyId)
        : [...favorites, propertyId];
      
      setFavorites(newFavorites);
      await AsyncStorage.setItem('favorites', JSON.stringify(newFavorites));
    } catch (error) {
      console.error('Failed to update favorites:', error);
    }
  };

  useFocusEffect(useCallback(() => {
    fetchProperties();
    loadFavorites();
  }, []));

  useEffect(() => {
    let filtered = [...properties];
    
    // Filter favorites if showFavorites is true
    if (showFavorites) {
      filtered = filtered.filter(property => favorites.includes(property._id));
    }
    
    // Search filter
    if (searchQuery.trim() !== '') {
      const fuse = new Fuse(filtered, {
        keys: ['name', 'location.address'],
        threshold: 0.3,
      });
      filtered = fuse.search(searchQuery).map(r => r.item);
    }

    // Sorting
    filtered.sort((a, b) => {
      const modifier = sortOrder === 'asc' ? 1 : -1;
      switch(sortBy) {
        case 'price':
          return modifier * (a.price - b.price);
        case 'name':
          return modifier * a.name.localeCompare(b.name);
        default:
          return 0;
      }
    });
    
    setFilteredProperties(filtered);
  }, [searchQuery, properties, sortBy, sortOrder, showFavorites, favorites]);

  const renderPropertyItem = ({ item, index }) => {
    const animatedValue = new Animated.Value(0);
    
    Animated.timing(animatedValue, {
      toValue: 1,
      duration: 400,
      delay: index * 50,
      useNativeDriver: true,
    }).start();

    const translateY = animatedValue.interpolate({
      inputRange: [0, 1],
      outputRange: [50, 0],
    });

    return (
      <Animated.View 
        style={[
          styles.propertyCard,
          { 
            opacity: animatedValue,
            transform: [{ translateY }]
          }
        ]}
      >
        <View style={styles.imageContainer}>
          <Image 
            source={{ 
              uri: item.images?.[0]?.startsWith('http') 
                ? item.images[0] 
                : `https://rentify-server-ge0f.onrender.com${item.images?.[0] || '/default.jpg'}` 
            }} 
            style={styles.propertyImage} 
          />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.7)']}
            style={styles.imageGradient}
          />
          
          {/* Property Type Badge */}
          <View style={styles.propertyTypeBadge}>
            <BlurView intensity={80} tint="dark" style={styles.badgeBlur}>
              <Ionicons name="home" size={12} color="#fff" />
              <Text style={styles.propertyTypeText}>{item.propertyType}</Text>
            </BlurView>
          </View>

          {/* Favorite Button */}
          <TouchableOpacity 
            style={styles.favoriteButton}
            onPress={() => toggleFavorite(item._id)}
          >
            <BlurView intensity={90} tint="light" style={styles.favoriteBlur}>
              <Ionicons 
                name={favorites.includes(item._id) ? "heart" : "heart-outline"} 
                size={20} 
                color={favorites.includes(item._id) ? "#E91E63" : "#6B7280"} 
              />
            </BlurView>
          </TouchableOpacity>
        </View>

        <View style={styles.propertyInfo}>
          {/* Title Row */}
          <View style={styles.titleRow}>
            <Text style={styles.propertyName} numberOfLines={2}>
              {item.name}
            </Text>
          </View>

          {/* Location Row */}
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={14} color="#8B5CF6" />
            <Text style={styles.locationText} numberOfLines={1}>
              {item.location?.address}
            </Text>
          </View>

          {/* Features Row */}
          <View style={styles.featuresRow}>
            <View style={styles.featureItem}>
              <Ionicons name="bed-outline" size={14} color="#6B7280" />
              <Text style={styles.featureText}>3 Beds</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="water-outline" size={14} color="#6B7280" />
              <Text style={styles.featureText}>2 Baths</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="resize-outline" size={14} color="#6B7280" />
              <Text style={styles.featureText}>120m²</Text>
            </View>
          </View>

          {/* Price Row */}
          <View style={styles.priceRow}>
            <View style={styles.priceContainer}>
              <Text style={styles.priceAmount}>₱{item.price?.toLocaleString()}</Text>
              <Text style={styles.priceLabel}>/month</Text>
            </View>
            <TouchableOpacity style={styles.viewButton}>
              <Text style={styles.viewButtonText}>View Details</Text>
              <Ionicons name="arrow-forward" size={16} color="#8B5CF6" />
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>
    );
  };

  const SortButton = ({ title, sortKey }) => (
    <TouchableOpacity 
      style={styles.sortButton}
      onPress={() => {
        if (sortBy === sortKey) {
          setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
          setSortBy(sortKey);
          setSortOrder('asc');
        }
      }}
    >
      <Text style={styles.sortButtonText}>{title}</Text>
      {sortBy === sortKey && (
        <Ionicons 
          name={sortOrder === 'asc' ? 'arrow-up' : 'arrow-down'} 
          size={16} 
          color={COLORS.primary} 
        />
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Gradient Background */}
      <LinearGradient
        colors={['#8B5CF6', '#7C3AED', '#6D28D9']}
        style={styles.gradientBackground}
      />

      {/* Modern Header with Glassmorphism */}
      <BlurView intensity={95} tint="light" style={styles.header}>
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.headerTitle}>Discover</Text>
            <Text style={styles.headerSubtitle}>
              {showFavorites 
                ? `${favorites.length} Favorites` 
                : `${filteredProperties.length} Properties`}
            </Text>
          </View>
          <View style={styles.headerButtons}>
            <TouchableOpacity 
              style={[styles.filterButton, showFavorites && styles.filterButtonActive]}
              onPress={() => setShowFavorites(!showFavorites)}
            >
              <Ionicons 
                name={showFavorites ? "heart" : "heart-outline"} 
                size={20} 
                color={showFavorites ? "#E91E63" : "#6B7280"} 
              />
            </TouchableOpacity>
          </View>
        </View>
      </BlurView>

      {/* Modern Search Bar */}
      <View style={styles.searchWrapper}>
        <BlurView intensity={90} tint="light" style={styles.searchContainer}>
          <Ionicons 
            name="search" 
            size={20} 
            color="#8B5CF6" 
            style={styles.searchIcon} 
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name or location..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </BlurView>
      </View>

      {/* Sort Container */}
      <View style={styles.sortWrapper}>
        <BlurView intensity={85} tint="light" style={styles.sortContainer}>
          <Text style={styles.sortTitle}>Sort by:</Text>
          <SortButton title="Price" sortKey="price" />
          <SortButton title="Name" sortKey="name" />
        </BlurView>
      </View>

      {/* Property List */}
      <FlatList
        data={filteredProperties}
        renderItem={renderPropertyItem}
        keyExtractor={(item) => item._id}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconContainer}>
              <Ionicons 
                name={showFavorites ? "heart-outline" : "home-outline"} 
                size={64} 
                color="#D1D5DB" 
              />
            </View>
            <Text style={styles.emptyTitle}>
              {showFavorites ? 'No Favorites Yet' : 'No Properties Found'}
            </Text>
            <Text style={styles.emptyText}>
              {showFavorites 
                ? 'Start adding properties to your favorites' 
                : 'Try adjusting your search or filters'}
            </Text>
          </View>
        }
        contentContainerStyle={styles.propertyListContainer}
        showsVerticalScrollIndicator={false}
      />

      {/* Floating Action Button */}
      <TouchableOpacity 
        style={styles.createButton}
        onPress={() => navigation.navigate('CreateProperty')}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={['#8B5CF6', '#7C3AED']}
          style={styles.createButtonGradient}
        >
          <Ionicons name="add" size={28} color="#fff" />
        </LinearGradient>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFBFC',
  },
  gradientBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 220,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    paddingTop: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.2)',
    overflow: 'hidden',
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: -0.8,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
    fontWeight: '600',
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  filterButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(229, 231, 235, 0.5)',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  filterButtonActive: {
    backgroundColor: '#FEF2F2',
    borderColor: 'rgba(254, 226, 226, 0.6)',
    shadowColor: '#E91E63',
    shadowOpacity: 0.15,
  },
  searchWrapper: {
    paddingHorizontal: 20,
    marginTop: 12,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(229, 231, 235, 0.5)',
    overflow: 'hidden',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
  },
  sortWrapper: {
    paddingHorizontal: 20,
    marginTop: 10,
    marginBottom: 12,
  },
  sortContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(229, 231, 235, 0.5)',
    overflow: 'hidden',
  },
  sortTitle: {
    marginRight: 10,
    fontWeight: '700',
    color: '#374151',
    fontSize: 13,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: 'rgba(139, 92, 246, 0.12)',
    borderRadius: 8,
  },
  sortButtonText: {
    marginRight: 3,
    color: '#8B5CF6',
    fontWeight: '700',
    fontSize: 12,
  },
  propertyListContainer: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  propertyCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    marginBottom: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  imageContainer: {
    position: 'relative',
    height: 180,
    width: '100%',
  },
  propertyImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  imageGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 70,
  },
  propertyTypeBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    borderRadius: 18,
    overflow: 'hidden',
  },
  badgeBlur: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 5,
  },
  propertyTypeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'capitalize',
    letterSpacing: 0.3,
  },
  favoriteButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    borderRadius: 18,
    overflow: 'hidden',
  },
  favoriteBlur: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  propertyInfo: {
    padding: 14,
  },
  titleRow: {
    marginBottom: 6,
  },
  propertyName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    lineHeight: 22,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 5,
  },
  locationText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
    flex: 1,
  },
  featuresRow: {
    flexDirection: 'row',
    marginBottom: 12,
    gap: 14,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  featureText: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '600',
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
  },
  priceAmount: {
    fontSize: 20,
    fontWeight: '800',
    color: '#8B5CF6',
    letterSpacing: -0.5,
  },
  priceLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F3FF',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    gap: 5,
  },
  viewButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8B5CF6',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  createButton: {
    position: 'absolute',
    bottom: 90,
    right: 20,
    width: 54,
    height: 54,
    borderRadius: 27,
    overflow: 'hidden',
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  createButtonGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
});