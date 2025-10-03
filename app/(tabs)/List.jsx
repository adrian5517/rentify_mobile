import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, Image, TextInput,
  TouchableOpacity, FlatList, StatusBar,
  Platform, Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
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

  const renderPropertyItem = ({ item }) => (
    <View style={styles.propertyListItem}>
      <Image 
        source={{ 
          uri: item.images?.[0]?.startsWith('http') 
            ? item.images[0] 
            : `https://rentify-server-ge0f.onrender.com${item.images?.[0] || '/default.jpg'}` 
        }} 
        style={styles.propertyListImage} 
      />
      <View style={styles.propertyListDetails}>
        <Text style={styles.propertyListName} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.propertyListLocation} numberOfLines={1}>
          {item.location?.address}
        </Text>
        <View style={styles.propertyListPriceRow}>
          <Text style={styles.propertyListPrice}>
            ₱{item.price}/month
          </Text>
          <View style={styles.propertyListBadges}>
            <Text style={styles.propertyListBadgeText}>
              {item.propertyType}
            </Text>
          </View>
        </View>
      </View>
      <TouchableOpacity 
        style={styles.favoriteButton}
        onPress={() => toggleFavorite(item._id)}
      >
        <Ionicons 
          name={favorites.includes(item._id) ? "heart" : "heart-outline"} 
          size={24} 
          color={favorites.includes(item._id) ? COLORS.primary : COLORS.gray} 
        />
      </TouchableOpacity>
    </View>
  );

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
      <StatusBar hidden />
      <LinearGradient
        colors={['#4c669f', '#3b5998', '#192f6a']}
        style={styles.gradientBackground}
      />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Property Listings</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity 
            style={[styles.filterButton, showFavorites && styles.filterButtonActive]}
            onPress={() => setShowFavorites(!showFavorites)}
          >
            <Ionicons 
              name={showFavorites ? "heart" : "heart-outline"} 
              size={24} 
              color={COLORS.white} 
            />
          </TouchableOpacity>
          <TouchableOpacity style={styles.filterButton}>
            <MaterialIcons name="filter-list" size={24} color={COLORS.white} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons 
          name="search" 
          size={20} 
          color={COLORS.primary} 
          style={styles.searchIcon} 
        />
        <TextInput
          style={styles.searchInput}
          placeholder="Search properties"
          placeholderTextColor={COLORS.gray}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <View style={styles.sortContainer}>
        <Text style={styles.sortTitle}>Sort By:</Text>
        <SortButton title="Price" sortKey="price" />
        <SortButton title="Name" sortKey="name" />
      </View>

      <FlatList
        data={filteredProperties}
        renderItem={renderPropertyItem}
        keyExtractor={(item) => item._id}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {showFavorites 
                ? 'No favorite properties yet' 
                : 'No properties found'}
            </Text>
          </View>
        }
        contentContainerStyle={styles.propertyListContainer}
      />

      <TouchableOpacity 
        style={styles.createButton}
        onPress={() => navigation.navigate('CreateProperty')}
      >
        <Ionicons name="add" size={30} color={COLORS.white} />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const MODERN_COLORS = {
  background: '#F5F7FA',
  primary: '#3B82F6',
  secondary: '#10B981',
  text: '#1F2937',
  textLight: '#6B7280',
  white: '#FFFFFF',
  border: '#E5E7EB'
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: MODERN_COLORS.background,
  },
  gradientBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 200,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: 'transparent',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.white,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  filterButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    padding: 8,
    borderRadius: 12,
  },
  filterButtonActive: {
    backgroundColor: COLORS.primary,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: MODERN_COLORS.white,
    marginHorizontal: 20,
    marginVertical: 10,
    borderRadius: 15,
    paddingHorizontal: 15,
    shadowColor: MODERN_COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    height: 50,
    color: COLORS.primary,
    fontSize: 16,
  },
  sortContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    marginHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  sortTitle: {
    marginRight: 10,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 15,
    padding: 8,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 8,
  },
  sortButtonText: {
    marginRight: 5,
    color: COLORS.primary,
    fontWeight: '600',
  },
  propertyListContainer: {
    
    paddingBottom: 80, // Add padding for FAB
  },
  propertyListItem: {
    flexDirection: 'row',
    backgroundColor: MODERN_COLORS.white,
    borderRadius: 15,
    marginBottom: 15,
    marginHorizontal: 20,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: MODERN_COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: MODERN_COLORS.border,
  },
  propertyListImage: {
    width: 120,
    height: 120,
    borderTopLeftRadius: 10,
    borderBottomLeftRadius: 10,
    resizeMode: 'cover',
  },
  propertyListDetails: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
  },
  propertyListName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  propertyListLocation: {
    color: COLORS.textLight,
    marginTop: 5,
    fontSize: 14,
  },
  propertyListPriceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  propertyListPrice: {
    fontSize: 18,
    color: COLORS.primary,
    fontWeight: 'bold',
  },
  propertyListBadges: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
  },
  propertyListBadgeText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 50,
  },
  emptyText: {
    fontSize: 18,
    color: COLORS.gray,
  },
  createButton: {
    position: 'absolute',
    bottom: 90,
    right: 30,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  favoriteButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    padding: 8,
    borderRadius: 20,
    elevation: 3,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
});