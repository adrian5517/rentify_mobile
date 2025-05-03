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
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';

export default function CreateProperty() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);

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

  // Fetch current location & get address on mount
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

  // Get address from coordinates
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
      <TextInput
        style={styles.input}
        value={property.type}
        onChangeText={text => setProperty(prev => ({ ...prev, type: text }))}
        placeholder="e.g. Apartment, Condo , Room , Dorm"
        placeholderTextColor="#999"
      />

      

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
        style={styles.input}
        multiline
        value={property.description}
        onChangeText={text => setProperty(prev => ({ ...prev, description: text }))}
        placeholder="Write something about the property"
        placeholderTextColor="#999"
      />

      <TouchableOpacity style={styles.button} onPress={() => setStep(2)}>
        <Text style={styles.buttonText}>Next</Text>
      </TouchableOpacity>
    </>
  );

  const renderStep2 = () => (
    <>
      <Text style={styles.label}>Status:</Text>
      <TextInput
        style={styles.input}
        value={property.status}
        onChangeText={text => setProperty(prev => ({ ...prev, status: text }))}
        placeholder="e.g. For Sale, For Rent"
      />

      <Text style={styles.label}>Amenities (comma-separated):</Text>
      <TextInput
        style={styles.input}
        value={property.amenities}
        onChangeText={text => setProperty(prev => ({ ...prev, amenities: text }))}
        placeholder="e.g. Pool, Gym, Parking"
      />

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
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Create Property Listing</Text>
      {step === 1 ? renderStep1() : renderStep2()}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  label: {
    marginTop: 10,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    borderRadius: 5,
    marginTop: 5,
  },
  button: {
    marginTop: 20,
    backgroundColor: '#3498db',
    padding: 12,
    borderRadius: 5,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  secondaryButton: {
    marginTop: 10,
    backgroundColor: '#7f8c8d',
    padding: 12,
    borderRadius: 5,
    alignItems: 'center',
  },
  secondaryText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  map: {
    width: '100%',
    height: 300,
    marginVertical: 20,
  },
  imagePreview: {
    width: 100,
    height: 100,
    marginRight: 10,
    borderRadius: 8,
  },
});
