import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, Image, TextInput,
  TouchableOpacity, FlatList, StatusBar, SafeAreaView,
  Platform
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import COLORS from '../../constant/colors';
import Fuse from 'fuse.js';
import { useFocusEffect } from '@react-navigation/native';

export default function List() {
  const [searchQuery, setSearchQuery] = useState('');
  const [properties, setProperties] = useState([]);
  const [filteredProperties, setFilteredProperties] = useState([]);
  const [sortBy, setSortBy] = useState('price'); // New sorting feature
  const [sortOrder, setSortOrder] = useState('asc');

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

  useFocusEffect(useCallback(() => {
    fetchProperties();
  }, []));

  useEffect(() => {
    let filtered = [...properties];
    
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
  }, [searchQuery, properties, sortBy, sortOrder]);

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
      <View style={styles.gradientBackground} />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Property Listings</Text>
        <TouchableOpacity>
          <MaterialIcons name="filter-list" size={24} color={COLORS.primary} />
        </TouchableOpacity>
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
            <Text style={styles.emptyText}>No properties found</Text>
          </View>
        }
        contentContainerStyle={styles.propertyListContainer}
      />
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
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.primary,
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
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    height: 50,
    color: COLORS.primary,
  },
  sortContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  sortTitle: {
    marginRight: 10,
    fontWeight: 'bold',
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10,
    padding: 5,
  },
  sortButtonText: {
    marginRight: 5,
    color: COLORS.primary,
  },
  propertyListContainer: {
    paddingHorizontal: 15,
  },
  propertyListItem: {
    flexDirection: 'row',
    backgroundColor: MODERN_COLORS.white,
    borderRadius: 15,
    marginBottom: 15,
    marginHorizontal: 20,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: MODERN_COLORS.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
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
    padding: 10,
    justifyContent: 'space-between',
  },
  propertyListName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  propertyListLocation: {
    color: COLORS.gray,
    marginTop: 5,
  },
  propertyListPriceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  propertyListPrice: {
    fontSize: 16,
    color: COLORS.primary,
    fontWeight: 'bold',
  },
  propertyListBadges: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 15,
  },
  propertyListBadgeText: {
    color: COLORS.white,
    fontSize: 12,
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
});