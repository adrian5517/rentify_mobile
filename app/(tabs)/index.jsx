import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, Image, TextInput, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import COLORS from '../../constant/colors';
import Fuse from 'fuse.js';

export default function Home() {
  const [username, setUsername] = useState('Guest');
  const [profilePicture, setProfilePicture] = useState('https://example.com/default-profile.png');
  const [searchQuery, setSearchQuery] = useState('');
  const [properties, setProperties] = useState([]);
  const [filteredProperties, setFilteredProperties] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
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

  return (
    <View style={styles.container}>
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

      <View style={[styles.cardBox , { marginTop: 50 }]}>
        <View style={styles.cardList}>
          <Text style={styles.cardTitle}>Nearby</Text>
        </View>

      </View>

      {/* Search box */}
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

      {/* Category filter */}
      <View style={styles.categoryWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {categories.map((category) => (
            <TouchableOpacity
              key={category}
              onPress={() => setSelectedCategory(category)}
              style={[
                styles.categoryButton,
                selectedCategory === category && styles.categoryButtonActive,
              ]}
            >
              <Text
                style={[
                  styles.categoryText,
                  selectedCategory === category && styles.categoryTextActive,
                ]}
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
                  <Text style={styles.propertyDescription}>{property.description}</Text>
                  {property.location ? (
                    <>
                      <Text style={styles.propertyLocation}>Location: {property.location.address}</Text>
                      <Text style={styles.propertyLocation}>
                        Coordinates: {property.location.latitude}, {property.location.longitude}
                      </Text>
                    </>
                  ) : (
                    <Text style={styles.propertyLocation}>Location: Not available</Text>
                  )}
                  <Text style={styles.propertyPostedBy}>Posted by: {property.postedBy}</Text>
                  <Text style={styles.propertyAmenities}>
                    Amenities: {property.amenities ? property.amenities.join(', ') : 'N/A'}
                  </Text>
                </View>
              );
            })
          ) : (
            <Text style={styles.noResultsText}>No properties found</Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 50 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    padding: 20,
    backgroundColor: 'white',
    zIndex: 10,
  },
  welcomeText: {
    flex: 1,
    fontSize: 23,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  profileImage: {
    width: 50,
    height: 50,
    borderRadius: 40,
    borderWidth: 0.5,
    borderColor: COLORS.primary,
    marginLeft: 10,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
    marginRight: 10,
  },
  searchButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    padding: 10,
  },
  cardBox: { 
    borderWidth:1,
    borderColor: COLORS.primary,
    borderRadius: 8,
    width: '30%',
    height: 70,
    margin: 20,
    backgroundColor: COLORS.primary,
  },
  cardList:{
    flexDirection: 'column',
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  cardTitle:{
    alignSelf: 'center',
    
  },
  categoryWrapper: {
    height: 50,
    marginTop: 10,
    paddingHorizontal: 20,
  },
  categoryButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    marginRight: 10,
    alignSelf: 'center',
  },
  categoryButtonActive: {
    backgroundColor: COLORS.primary,
  },
  categoryText: {
    fontWeight: 'bold',
    color: '#333',
  },
  categoryTextActive: {
    color: '#fff',
  },
  scrollContent: { paddingBottom: 20 },
  filteredDataContainer: { marginTop: 20 },
  propertyCard: {
    marginBottom: 20,
    margin: 20,
    borderWidth: 1,
    borderColor: COLORS.primary,
    padding: 15,
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  propertyImage: { width: '100%', height: 200, borderRadius: 8 },
  propertyName: { fontSize: 18, fontWeight: 'bold', marginTop: 10 },
  propertyPrice: { fontSize: 16, color: COLORS.primary, marginTop: 5 },
  propertyDescription: { fontSize: 14, marginTop: 5, color: '#333' },
  propertyLocation: { fontSize: 14, marginTop: 5, color: '#555' },
  propertyPostedBy: { fontSize: 14, marginTop: 5, color: '#777' },
  propertyAmenities: { fontSize: 14, marginTop: 5, color: '#777' },
  noResultsText: { textAlign: 'center', fontSize: 18, color: '#999', marginTop: 20 },
});
