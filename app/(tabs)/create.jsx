<<<<<<< HEAD
import { View, Text } from 'react-native'
import React from 'react'

export default function Create() {
  return (
    <View>
      <Text>Create Tab</Text>
    </View>
  )
}
=======
import {
  View,
  Text,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  TextInput,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import React from 'react';
import { useRouter } from 'expo-router';
import styles from '@/assets/styles/create.styles';
import { Ionicons } from '@expo/vector-icons';
import COLORS from '@/constant/colors';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '@/store/authStore';
import { API_URL } from '@/constant/api';

export default function Create() {
  const [title, setTitle] = React.useState('');
  const [address, setAddress] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [price, setPrice] = React.useState('');
  const [image, setImage] = React.useState(null);
  const [isLoading, setIsLoading] = React.useState(false);

  const { token, userId } = useAuthStore(); // Add userId to destructuring
  const router = useRouter();

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'We need camera roll permissions to upload an image');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.4,
      });

      if (!result.canceled) {
        setImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Image Picker Error:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const handleSubmit = async () => {
    if (!title.trim() || !address.trim() || !description.trim() || !price || !image) {
      Alert.alert('Error', 'All fields are required');
      return;
    }

    if (!userId) {
      Alert.alert('Error', 'User not authenticated');
      return;
    }

    try {
      setIsLoading(true);

      const formData = new FormData();
      // Basic property data
      formData.append('name', title.trim());
      formData.append('address', address.trim());
      formData.append('description', description.trim());
      formData.append('price', parseFloat(price));
      
      // Send ownerId as a separate field to ensure proper handling
      formData.append('ownerId', userId.toString());

      // Image handling
      const filename = image.split('/').pop();
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';
      
      // Create blob-like object for the image
      const imageFile = {
        uri: Platform.OS === 'ios' ? image.replace('file://', '') : image,
        name: filename || 'photo.jpg',
        type: type
      };

      formData.append('images', imageFile);

      console.log('Form data:', {
        name: title.trim(),
        address: address.trim(),
        description: description.trim(),
        price: parseFloat(price),
        ownerId: userId.toString()
      });

      const response = await fetch(`${API_URL}/api/property`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      // Log response for debugging
      console.log('Response status:', response.status);
      const responseText = await response.text();
      console.log('Response text:', responseText);

      if (!response.ok) {
        throw new Error(`Server error: ${responseText}`);
      }

      Alert.alert('Success', 'Property created successfully!');
      setTitle('');
      setAddress('');
      setDescription('');
      setPrice('');
      setImage(null);
      router.push('/(tabs)/home');

    } catch (error) {
      console.error('Submit Error:', error);
      Alert.alert('Error', 'Failed to create property. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.container} style={styles.scrollViewStyle}>
        <View style={styles.card}>
          <Text style={styles.title}>Add property</Text>
          <Text style={styles.subtitle}>Add a new property to your list</Text>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Property Name</Text>
            <View style={styles.inputContainer}>
              <Ionicons
                name="home-outline"
                size={20}
                color={COLORS.textSecondary}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="Enter property name"
                placeholderTextColor={COLORS.placeholderText}
                value={title}
                onChangeText={setTitle}
              />
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Address</Text>
            <View style={[styles.inputContainer, { minHeight: 60 }]}>
              <Ionicons
                name="location-outline"
                size={20}
                color={COLORS.textSecondary}
                style={[styles.inputIcon, { marginTop: 8 }]}
              />
              <TextInput
                style={[styles.input, { textAlignVertical: 'top', paddingTop: 8, height: 60 }]}
                placeholder="Enter property address"
                placeholderTextColor={COLORS.placeholderText}
                value={address}
                onChangeText={setAddress}
              />
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Price</Text>
            <View style={styles.inputContainer}>
              <Ionicons
                name="cash-outline"
                size={20}
                color={COLORS.textSecondary}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="Enter property price"
                placeholderTextColor={COLORS.placeholderText}
                value={price}
                onChangeText={setPrice}
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Property Image</Text>
            <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
              {image ? (
                <Image source={{ uri: image }} style={styles.previewImage} />
              ) : (
                <View style={styles.placeholderContainer}>
                  <Ionicons name="image-outline" size={40} color={COLORS.textSecondary} />
                  <Text style={styles.placeholderText}>Tap to select image</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={styles.textArea}
              placeholder="Write details about your property..."
              placeholderTextColor={COLORS.placeholderText}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
            />
          </View>

          <TouchableOpacity
            style={styles.button}
            onPress={handleSubmit}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <>
                <Ionicons
                  name="add-circle-outline"
                  size={20}
                  color={COLORS.white}
                  style={styles.buttonIcon}
                />
                <Text style={styles.buttonText}>Add Property</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
>>>>>>> my-changes
