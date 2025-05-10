import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Alert,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Platform,
  Modal,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

export default function CreateProperty() {
  const navigation = useNavigation();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);

  const propertyTypes = [
    'Apartment',
    'House',
    'Boarding House',
    'Room',
    'Dorm',
    'Studio',
    'Townhouse',
    
  ];

  const propertyStatus = [
    'Available',
    'For Sale',
    'Rented',
    'Sold'
  ];

  const [property, setProperty] = useState({
    name: '',
    type: '',
    price: '',
    description: '',
    status: '',
    amenities: '',
    address: '',
    location: null,
    images: [],
  });

  useEffect(() => {
    (async () => {
      const imageStatus = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (imageStatus.status !== 'granted') {
        Alert.alert('Permission Denied', 'Please allow image access to continue.');
      }

      const locStatus = await Location.requestForegroundPermissionsAsync();
      if (locStatus.status !== 'granted') {
        Alert.alert('Permission Denied', 'Location access is needed for the map.');
        setLoading(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const coords = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      setProperty(prev => ({ ...prev, location: coords }));
      await fetchAddressFromCoords(coords);
      setLoading(false);
    })();
  }, []);

  const fetchAddressFromCoords = async (coords) => {
    try {
      const [place] = await Location.reverseGeocodeAsync(coords);
      if (place) {
        const formattedAddress = `${place.name || ''} ${place.street || ''}, ${place.city || ''}, ${place.region || ''} ${place.postalCode || ''}, ${place.country || ''}`;
        setProperty(prev => ({ ...prev, address: formattedAddress }));
      }
    } catch (error) {
      console.log('Error fetching address:', error);
    }
  };

  const handleImagePick = async () => {
    if (property.images.length >= 5) {
      Alert.alert('Limit Reached', 'You can only select up to 5 images.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsMultipleSelection: true,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });

    if (!result.canceled && result.assets?.length > 0) {
      const selected = result.assets.map(asset => asset.uri);
      setProperty(prev => ({
        ...prev,
        images: [...prev.images, ...selected].slice(0, 5),
      }));
    }
  };

  const handleMapPress = async (event) => {
    const { coordinate } = event.nativeEvent;
    setProperty(prev => ({ ...prev, location: coordinate }));
    await fetchAddressFromCoords(coordinate);
  };

  const handleMarkerDragEnd = async (e) => {
    const { coordinate } = e.nativeEvent;
    setProperty(prev => ({ ...prev, location: coordinate }));
    await fetchAddressFromCoords(coordinate);
  };

  const handleSubmit = async () => {
    const { name, type, price, description, status, amenities, location, images, address } = property;

    if (!name || !type || !price || !description || !status || !amenities || !location || !address || images.length === 0) {
      Alert.alert('Missing Fields', 'Please complete all fields, including map and images.');
      return;
    }

    try {
      const formData = new FormData();

      formData.append('name', name);
      formData.append('description', description);
      formData.append('price', price);
      formData.append('propertyType', type);
      formData.append('status', status.toLowerCase());
      formData.append('latitude', location.latitude);
      formData.append('longitude', location.longitude);
      formData.append('address', address);

      const amenitiesArray = amenities.split(',').map(item => item.trim());
      amenitiesArray.forEach(a => formData.append('amenities', a));

      images.forEach((uri, index) => {
        const filename = uri.split('/').pop();
        const match = /\.(\w+)$/.exec(filename);
        const ext = match ? match[1] : 'jpg';

        formData.append('images', {
          uri,
          name: `image_${index}.${ext}`,
          type: `image/${ext}`,
        });
      });

      const response = await fetch('https://rentify-server-ge0f.onrender.com/api/properties', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Something went wrong!');
      }

      Alert.alert('Success', 'Property created successfully!');
      setProperty({
        name: '',
        type: '',
        price: '',
        address: '',
        description: '',
        status: '',
        amenities: '',
        location: null,
        images: [],
      });
      setStep(1);
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity 
        style={styles.backButton} 
        onPress={() => navigation.navigate('List')}
      >
        <Ionicons name="arrow-back" size={24} color="#34495e" />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Create Property</Text>
    </View>
  );

  const renderPickerModal = (visible, onClose, options, selectedValue, onSelect) => (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.pickerList}>
            {options.map((option) => (
              <TouchableOpacity
                key={option}
                style={[
                  styles.pickerOption,
                  selectedValue === option && styles.selectedOption
                ]}
                onPress={() => {
                  onSelect(option);
                  onClose();
                }}
              >
                <Text style={[
                  styles.pickerOptionText,
                  selectedValue === option && styles.selectedOptionText
                ]}>
                  {option}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  const renderStep1 = () => (
    <>
      <Text style={styles.label}>Property Name:</Text>
      <TextInput
        style={styles.input}
        value={property.name}
        onChangeText={text => setProperty(prev => ({ ...prev, name: text }))}
        placeholder="e.g. Green Hills Apartment"
        placeholderTextColor="#999"
      />

      <Text style={styles.label}>Property Type:</Text>
      <TouchableOpacity
        style={styles.pickerButton}
        onPress={() => setShowTypePicker(true)}
      >
        <Text style={[
          styles.pickerButtonText,
          !property.type && styles.placeholderText
        ]}>
          {property.type || 'Select Property Type'}
        </Text>
        <Ionicons name="chevron-down" size={20} color="#34495e" />
      </TouchableOpacity>

      {renderPickerModal(
        showTypePicker,
        () => setShowTypePicker(false),
        propertyTypes,
        property.type,
        (value) => setProperty(prev => ({ ...prev, type: value }))
      )}

      <Text style={styles.label}>Price (₱):</Text>
      <TextInput
        style={styles.input}
        keyboardType="numeric"
        value={property.price}
        onChangeText={text => setProperty(prev => ({ ...prev, price: text }))}
        placeholder="e.g. 5000"
        placeholderTextColor="#999"
      />

      <Text style={styles.label}>Description:</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        multiline
        numberOfLines={4}
        value={property.description}
        onChangeText={text => setProperty(prev => ({ ...prev, description: text }))}
        placeholder="Write something about the property"
        placeholderTextColor="#999"
      />

      <Text style={styles.label}>Status:</Text>
      <TouchableOpacity
        style={styles.pickerButton}
        onPress={() => setShowStatusPicker(true)}
      >
        <Text style={[
          styles.pickerButtonText,
          !property.status && styles.placeholderText
        ]}>
          {property.status || 'Select Status'}
        </Text>
        <Ionicons name="chevron-down" size={20} color="#34495e" />
      </TouchableOpacity>

      {renderPickerModal(
        showStatusPicker,
        () => setShowStatusPicker(false),
        propertyStatus,
        property.status,
        (value) => setProperty(prev => ({ ...prev, status: value }))
      )}

      <Text style={styles.label}>Amenities (comma-separated):</Text>
      <TextInput
        style={styles.input}
        value={property.amenities}
        onChangeText={text => setProperty(prev => ({ ...prev, amenities: text }))}
        placeholder="e.g. Pool, Gym, Parking"
        placeholderTextColor="#999"
      />

      <TouchableOpacity style={styles.button} onPress={() => setStep(2)}>
        <Text style={styles.buttonText}>Next</Text>
      </TouchableOpacity>
    </>
  );

  const renderStep2 = () => (
    <>
      

      <Text style={styles.label}>Select Location on Map:</Text>
      {loading ? (
        <ActivityIndicator size="large" color="#0000ff" />
      ) : (
        <MapView
          style={styles.map}
          initialRegion={{
            latitude: property.location?.latitude || 13.41,
            longitude: property.location?.longitude || 122.55,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
          onPress={handleMapPress}
        >
          {property.location && (
            <Marker
              coordinate={property.location}
              draggable
              onDragEnd={handleMarkerDragEnd}
            />
          )}
        </MapView>
      )}

      <Text style={styles.label}>Address (Auto-filled):</Text>
      <TextInput
        style={[styles.input, { backgroundColor: '#eee' }]}
        value={property.address}
        editable={false}
      />

      <Text style={styles.label}>Selected Images:</Text>
      <ScrollView horizontal>
        {property.images.map((uri, index) => (
          <Image key={index} source={{ uri }} style={styles.imagePreview} />
        ))}
      </ScrollView>

      <TouchableOpacity style={styles.button} onPress={handleImagePick}>
        <Text style={styles.buttonText}>Pick Images</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.button} onPress={handleSubmit}>
        <Text style={styles.buttonText}>Submit</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.secondaryButton} onPress={() => setStep(1)}>
        <Text style={styles.secondaryText}>Back</Text>
      </TouchableOpacity>
    </>
  );

  return (
    <View style={styles.mainContainer}>
      {renderHeader()}
      <ScrollView style={styles.container}>
        <View style={styles.card}>
          {step === 1 ? renderStep1() : renderStep2()}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: '#f9f9f9',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 50 : 40,
    paddingHorizontal: 20,
    paddingBottom: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#34495e',
    marginLeft: 10,
  },
  container: {
    flex: 1,
    padding: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  label: {
    marginTop: 15,
    marginBottom: 5,
    fontWeight: '600',
    color: '#34495e',
    fontSize: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#dfe6e9',
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#fff',
    fontSize: 16,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: '#dfe6e9',
    borderRadius: 8,
    backgroundColor: '#fff',
    marginBottom: 5,
    overflow: 'hidden',
  },
  picker: {
    height: 50,
    width: '100%',
    color: '#34495e',
  },
  button: {
    marginTop: 25,
    backgroundColor: '#3498db',
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: '#2980b9',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  secondaryButton: {
    marginTop: 15,
    backgroundColor: '#bdc3c7',
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  secondaryText: {
    color: '#2c3e50',
    fontWeight: 'bold',
    fontSize: 16,
  },
  map: {
    width: '100%',
    height: 300,
    marginTop: 10,
    borderRadius: 10,
  },
  imagePreview: {
    width: 100,
    height: 100,
    marginRight: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    alignItems: 'flex-end',
  },
  closeButton: {
    padding: 5,
  },
  closeButtonText: {
    color: '#3498db',
    fontSize: 16,
    fontWeight: '600',
  },
  pickerList: {
    maxHeight: 300,
  },
  pickerOption: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  selectedOption: {
    backgroundColor: '#f0f8ff',
  },
  pickerOptionText: {
    fontSize: 16,
    color: '#34495e',
  },
  selectedOptionText: {
    color: '#3498db',
    fontWeight: '600',
  },
  pickerButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#dfe6e9',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#fff',
    marginBottom: 5,
  },
  pickerButtonText: {
    fontSize: 16,
    color: '#34495e',
  },
  placeholderText: {
    color: '#999',
  },
});
