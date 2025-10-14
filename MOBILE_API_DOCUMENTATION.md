# 📱 Rentify Mobile API Documentation

**Version:** 1.0.0  
**Last Updated:** October 14, 2025  
**Base URL:** `https://rentify-server-ge0f.onrender.com`

---

## 📋 Table of Contents

1. [Authentication](#authentication)
2. [Property Endpoints](#property-endpoints)
3. [User Endpoints](#user-endpoints)
4. [Message Endpoints](#message-endpoints)
5. [ML Clustering Endpoints](#ml-clustering-endpoints)
6. [Response Formats](#response-formats)
7. [Error Handling](#error-handling)
8. [Mobile Implementation Guide](#mobile-implementation-guide)

---

## 🔐 Authentication

### How Authentication Works

The API uses **JWT (JSON Web Tokens)** for authentication.

#### 1. **Register User**
```http
POST /api/auth/register
Content-Type: application/json

{
  "username": "maria_santos",
  "email": "maria@example.com",
  "password": "SecurePass123!",
  "fullName": "Maria Santos",
  "phoneNumber": "+63 917 234 5678"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User registered successfully",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "_id": "681b26b2c58b946b8d16dacf",
    "username": "maria_santos",
    "email": "maria@example.com",
    "fullName": "Maria Santos",
    "phoneNumber": "+63 917 234 5678"
  }
}
```

#### 2. **Login**
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "maria@example.com",
  "password": "SecurePass123!"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "_id": "681b26b2c58b946b8d16dacf",
    "username": "maria_santos",
    "email": "maria@example.com",
    "fullName": "Maria Santos"
  }
}
```

#### 3. **Using JWT Token**

Include the token in Authorization header for protected endpoints:

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## 🏠 Property Endpoints

### 1. **Get All Properties** (PUBLIC)

**How it's implemented in Web:**
```typescript
// app/page.tsx - Line 754
const fetchPropertiesFromAPI = async () => {
  const response = await fetch('https://rentify-server-ge0f.onrender.com/api/properties')
  const data = await response.json()
  
  // Handle different response formats
  let properties = []
  if (Array.isArray(data)) {
    properties = data
  } else if (data.properties && Array.isArray(data.properties)) {
    properties = data.properties
  } else if (data.success && data.properties) {
    properties = data.properties
  }
}
```

**Endpoint:**
```http
GET /api/properties
```

**Response:**
```json
{
  "success": true,
  "count": 20,
  "properties": [
    {
      "_id": "67305d7cb78c9c0e26a3bb8f",
      "name": "Modern Apartment in Downtown Naga",
      "description": "Luxurious 2-bedroom apartment...",
      "price": 15000,
      "location": {
        "address": "Magsaysay Avenue, Naga City",
        "latitude": 13.6218,
        "longitude": 123.1815
      },
      "images": [
        "https://res.cloudinary.com/dxlqh5rw0/image/upload/v1234567890/property1.jpg"
      ],
      "propertyType": "apartment",
      "amenities": ["WiFi", "Parking", "Security"],
      "status": "available",
      "phoneNumber": "+63 912 345 6789",
      "postedBy": {
        "_id": "681b26b2c58b946b8d16dacf",
        "username": "maria_santos",
        "email": "maria@example.com",
        "fullName": "Maria Santos",
        "phoneNumber": "+63 917 234 5678",
        "profilePicture": "https://res.cloudinary.com/..."
      },
      "createdAt": "2025-10-14T12:00:00.000Z"
    }
  ]
}
```

**Mobile Implementation (Flutter Example):**
```dart
Future<List<Property>> fetchProperties() async {
  final response = await http.get(
    Uri.parse('https://rentify-server-ge0f.onrender.com/api/properties'),
  );

  if (response.statusCode == 200) {
    final data = jsonDecode(response.body);
    
    // Handle different response formats
    List<dynamic> propertiesJson;
    if (data is List) {
      propertiesJson = data;
    } else if (data['properties'] != null) {
      propertiesJson = data['properties'];
    }
    
    return propertiesJson.map((json) => Property.fromJson(json)).toList();
  }
  
  throw Exception('Failed to load properties');
}
```

---

### 2. **Get Property by ID** (PUBLIC)

**Endpoint:**
```http
GET /api/properties/:id
```

**Example:**
```http
GET /api/properties/67305d7cb78c9c0e26a3bb8f
```

**Response:**
```json
{
  "success": true,
  "property": {
    "_id": "67305d7cb78c9c0e26a3bb8f",
    "name": "Modern Apartment",
    "description": "Beautiful apartment with city views",
    "price": 15000,
    "location": {
      "address": "Magsaysay Avenue, Naga City",
      "latitude": 13.6218,
      "longitude": 123.1815
    },
    "images": ["url1", "url2"],
    "propertyType": "apartment",
    "amenities": ["WiFi", "Parking"],
    "status": "available",
    "postedBy": {
      "_id": "681b26b2c58b946b8d16dacf",
      "fullName": "Maria Santos",
      "phoneNumber": "+63 917 234 5678",
      "email": "maria@example.com"
    },
    "createdAt": "2025-10-14T12:00:00.000Z"
  }
}
```

**Mobile Implementation:**
```dart
Future<Property> fetchPropertyById(String id) async {
  final response = await http.get(
    Uri.parse('https://rentify-server-ge0f.onrender.com/api/properties/$id'),
  );

  if (response.statusCode == 200) {
    final data = jsonDecode(response.body);
    return Property.fromJson(data['property']);
  }
  
  throw Exception('Property not found');
}
```

---

### 3. **Create Property** (PROTECTED - Requires Auth)

**How it's implemented in Web:**
```typescript
// components/add-property-modal.tsx - Line 250
const handleSubmit = async (e: React.FormEvent) => {
  const token = localStorage.getItem('auth-storage')
  
  const response = await fetch('https://rentify-server-ge0f.onrender.com/api/properties', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      name: formData.name,
      description: formData.description,
      price: Number(formData.price),
      location: {
        address: formData.address,
        latitude: Number(formData.latitude),
        longitude: Number(formData.longitude)
      },
      propertyType: formData.propertyType,
      amenities: formData.amenities,
      images: uploadedImages,
      phoneNumber: formData.phoneNumber
    })
  })
}
```

**Endpoint:**
```http
POST /api/properties
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "name": "Modern Studio Apartment",
  "description": "Cozy studio perfect for students",
  "price": 8000,
  "location": {
    "address": "Near Ateneo de Naga University",
    "latitude": 13.6301,
    "longitude": 123.1967
  },
  "propertyType": "apartment",
  "amenities": ["WiFi", "Air Conditioning", "Security"],
  "images": [
    "https://res.cloudinary.com/dxlqh5rw0/image/upload/v1234567890/property1.jpg"
  ],
  "phoneNumber": "+63 912 345 6789",
  "status": "available"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Property created successfully",
  "property": {
    "_id": "67305d7cb78c9c0e26a3bb8f",
    "name": "Modern Studio Apartment",
    "price": 8000,
    "postedBy": {
      "_id": "681b26b2c58b946b8d16dacf",
      "fullName": "Maria Santos",
      "email": "maria@example.com"
    },
    "createdAt": "2025-10-14T12:00:00.000Z"
  }
}
```

**Mobile Implementation:**
```dart
Future<Property> createProperty({
  required String token,
  required PropertyData propertyData,
}) async {
  final response = await http.post(
    Uri.parse('https://rentify-server-ge0f.onrender.com/api/properties'),
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer $token',
    },
    body: jsonEncode({
      'name': propertyData.name,
      'description': propertyData.description,
      'price': propertyData.price,
      'location': {
        'address': propertyData.address,
        'latitude': propertyData.latitude,
        'longitude': propertyData.longitude,
      },
      'propertyType': propertyData.type,
      'amenities': propertyData.amenities,
      'images': propertyData.imageUrls,
      'phoneNumber': propertyData.phone,
    }),
  );

  if (response.statusCode == 201) {
    final data = jsonDecode(response.body);
    return Property.fromJson(data['property']);
  }
  
  throw Exception('Failed to create property');
}
```

---

### 4. **Update Property** (PROTECTED - Owner Only)

**Endpoint:**
```http
PUT /api/properties/:id
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "name": "Updated Property Name",
  "price": 12000,
  "status": "rented"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Property updated successfully",
  "property": {
    "_id": "67305d7cb78c9c0e26a3bb8f",
    "name": "Updated Property Name",
    "price": 12000,
    "status": "rented"
  }
}
```

---

### 5. **Delete Property** (PROTECTED - Owner Only)

**Endpoint:**
```http
DELETE /api/properties/:id
Authorization: Bearer <JWT_TOKEN>
```

**Response:**
```json
{
  "success": true,
  "message": "Property deleted successfully"
}
```

---

### 6. **Get User's Properties** (PROTECTED)

**Endpoint:**
```http
GET /api/properties/user/:userId
Authorization: Bearer <JWT_TOKEN>
```

**Example:**
```http
GET /api/properties/user/681b26b2c58b946b8d16dacf
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response:**
```json
{
  "success": true,
  "count": 5,
  "properties": [
    {
      "_id": "67305d7cb78c9c0e26a3bb8f",
      "name": "My Property 1",
      "price": 15000,
      "status": "available",
      "createdAt": "2025-10-14T12:00:00.000Z"
    }
  ]
}
```

**Mobile Implementation:**
```dart
Future<List<Property>> fetchMyProperties(String token, String userId) async {
  final response = await http.get(
    Uri.parse('https://rentify-server-ge0f.onrender.com/api/properties/user/$userId'),
    headers: {
      'Authorization': 'Bearer $token',
    },
  );

  if (response.statusCode == 200) {
    final data = jsonDecode(response.body);
    List<dynamic> propertiesJson = data['properties'] ?? [];
    return propertiesJson.map((json) => Property.fromJson(json)).toList();
  }
  
  throw Exception('Failed to fetch user properties');
}
```

---

### 7. **Search Properties** (PUBLIC)

**Endpoint:**
```http
GET /api/properties/search?query=apartment&minPrice=5000&maxPrice=15000&propertyType=apartment&location=Naga
```

**Query Parameters:**
- `query` - Search in name, description, address
- `minPrice` - Minimum price filter
- `maxPrice` - Maximum price filter
- `propertyType` - Filter by type (apartment, house, condo, etc.)
- `location` - Filter by location/address

**Response:**
```json
{
  "success": true,
  "count": 8,
  "properties": [
    {
      "_id": "67305d7cb78c9c0e26a3bb8f",
      "name": "Modern Apartment",
      "price": 12000,
      "propertyType": "apartment",
      "location": {
        "address": "Magsaysay Avenue, Naga City"
      }
    }
  ]
}
```

**Mobile Implementation:**
```dart
Future<List<Property>> searchProperties({
  String? query,
  double? minPrice,
  double? maxPrice,
  String? propertyType,
  String? location,
}) async {
  final queryParams = <String, String>{};
  if (query != null) queryParams['query'] = query;
  if (minPrice != null) queryParams['minPrice'] = minPrice.toString();
  if (maxPrice != null) queryParams['maxPrice'] = maxPrice.toString();
  if (propertyType != null) queryParams['propertyType'] = propertyType;
  if (location != null) queryParams['location'] = location;

  final uri = Uri.parse('https://rentify-server-ge0f.onrender.com/api/properties/search')
      .replace(queryParameters: queryParams);

  final response = await http.get(uri);

  if (response.statusCode == 200) {
    final data = jsonDecode(response.body);
    List<dynamic> propertiesJson = data['properties'] ?? [];
    return propertiesJson.map((json) => Property.fromJson(json)).toList();
  }
  
  throw Exception('Failed to search properties');
}
```

---

## 🤖 ML Clustering Endpoints

### How ML Clustering Works in Web

**Implementation in Web:**
```typescript
// components/property-map.tsx - Line 405
const fetchMLClusters = async () => {
  // 1. Fetch all properties from database
  const fullPropertyRes = await fetch('https://rentify-server-ge0f.onrender.com/api/properties')
  const data = await fullPropertyRes.json()
  
  // 2. For each property, call ML API to get cluster
  const classifiedProperties = await Promise.all(
    allProperties.map(async (property) => {
      // Call ML prediction API
      const response = await fetch('/api/ml-predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          price: property.price,
          latitude: property.location.latitude,
          longitude: property.location.longitude
        })
      })
      
      const result = await response.json()
      // result.cluster_id = 0 (Low Budget), 1 (Mid Range), 2 (High End)
      return { ...property, cluster: result.cluster_id }
    })
  )
}
```

### ML Prediction Endpoint (Proxied through Next.js)

**Web Endpoint (Proxy):**
```http
POST /api/ml-predict
Content-Type: application/json

{
  "price": 12000,
  "latitude": 13.6218,
  "longitude": 123.1815
}
```

**Direct ML API (For Mobile):**
```http
POST https://new-train-ml.onrender.com/predict_kmeans
Content-Type: application/json

{
  "price": 12000,
  "latitude": 13.6218,
  "longitude": 123.1815
}
```

**Response:**
```json
{
  "cluster_id": 1,
  "cluster_label": "Mid Range"
}
```

**Cluster Classification:**
- **Cluster 0**: Low Budget (₱1 - ₱3,000)
- **Cluster 1**: Mid Range (₱3,001 - ₱5,000)
- **Cluster 2**: High End (₱5,001+)

**Mobile Implementation:**
```dart
Future<PropertyCluster> predictCluster({
  required double price,
  required double latitude,
  required double longitude,
}) async {
  final response = await http.post(
    Uri.parse('https://new-train-ml.onrender.com/predict_kmeans'),
    headers: {'Content-Type': 'application/json'},
    body: jsonEncode({
      'price': price,
      'latitude': latitude,
      'longitude': longitude,
    }),
  );

  if (response.statusCode == 200) {
    final data = jsonDecode(response.body);
    return PropertyCluster(
      id: data['cluster_id'],
      label: data['cluster_label'],
    );
  }
  
  throw Exception('Failed to predict cluster');
}

// Classify all properties
Future<List<Property>> classifyProperties(List<Property> properties) async {
  return await Future.wait(
    properties.map((property) async {
      try {
        final cluster = await predictCluster(
          price: property.price,
          latitude: property.location.latitude,
          longitude: property.location.longitude,
        );
        return property.copyWith(cluster: cluster.id);
      } catch (e) {
        // Fallback to price-based classification
        int clusterId;
        if (property.price > 0 && property.price <= 3000) {
          clusterId = 0;
        } else if (property.price > 3000 && property.price <= 5000) {
          clusterId = 1;
        } else {
          clusterId = 2;
        }
        return property.copyWith(cluster: clusterId);
      }
    })
  );
}
```

---

## 👤 User Endpoints

### Get Current User Profile (PROTECTED)

**Endpoint:**
```http
GET /api/users/profile
Authorization: Bearer <JWT_TOKEN>
```

**Response:**
```json
{
  "success": true,
  "user": {
    "_id": "681b26b2c58b946b8d16dacf",
    "username": "maria_santos",
    "email": "maria@example.com",
    "fullName": "Maria Santos",
    "phoneNumber": "+63 917 234 5678",
    "profilePicture": "https://res.cloudinary.com/...",
    "address": "Naga City, Camarines Sur",
    "createdAt": "2025-10-01T10:00:00.000Z"
  }
}
```

---

## 💬 Message Endpoints

### Get Conversations (PROTECTED)

**Endpoint:**
```http
GET /api/messages/conversations
Authorization: Bearer <JWT_TOKEN>
```

### Send Message (PROTECTED)

**Endpoint:**
```http
POST /api/messages
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "recipientId": "681b26b2c58b946b8d16dacf",
  "propertyId": "67305d7cb78c9c0e26a3bb8f",
  "message": "I'm interested in this property"
}
```

---

## 📤 Image Upload (Cloudinary)

### How Image Upload Works in Web

**Implementation:**
```typescript
// components/add-property-modal.tsx - Line 180
const handleImageUpload = async (files: File[]) => {
  const formData = new FormData()
  files.forEach(file => formData.append('images', file))

  const response = await fetch('https://rentify-server-ge0f.onrender.com/upload', {
    method: 'POST',
    body: formData
  })

  const data = await response.json()
  // data.urls = ["https://res.cloudinary.com/..."]
}
```

**Endpoint:**
```http
POST /upload
Content-Type: multipart/form-data

images: <file1>
images: <file2>
```

**Response:**
```json
{
  "success": true,
  "urls": [
    "https://res.cloudinary.com/dxlqh5rw0/image/upload/v1234567890/property1.jpg",
    "https://res.cloudinary.com/dxlqh5rw0/image/upload/v1234567891/property2.jpg"
  ]
}
```

**Mobile Implementation (Flutter):**
```dart
Future<List<String>> uploadImages(List<File> images) async {
  var request = http.MultipartRequest(
    'POST',
    Uri.parse('https://rentify-server-ge0f.onrender.com/upload'),
  );

  for (var image in images) {
    request.files.add(
      await http.MultipartFile.fromPath('images', image.path),
    );
  }

  var response = await request.send();
  
  if (response.statusCode == 200) {
    var responseData = await response.stream.bytesToString();
    var data = jsonDecode(responseData);
    return List<String>.from(data['urls']);
  }
  
  throw Exception('Failed to upload images');
}
```

---

## 🔄 Response Formats

### Success Response
```json
{
  "success": true,
  "message": "Operation successful",
  "data": { /* ... */ }
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error message",
  "error": "Detailed error description"
}
```

---

## ⚠️ Error Handling

### Common HTTP Status Codes

- **200 OK** - Request successful
- **201 Created** - Resource created successfully
- **400 Bad Request** - Invalid request data
- **401 Unauthorized** - Missing or invalid token
- **403 Forbidden** - Not authorized for this action
- **404 Not Found** - Resource not found
- **500 Internal Server Error** - Server error

### Mobile Error Handling Example

```dart
Future<T> handleApiRequest<T>(Future<http.Response> request) async {
  try {
    final response = await request;
    
    final data = jsonDecode(response.body);
    
    if (response.statusCode >= 200 && response.statusCode < 300) {
      return data as T;
    }
    
    // Handle specific error codes
    switch (response.statusCode) {
      case 400:
        throw BadRequestException(data['message']);
      case 401:
        throw UnauthorizedException('Please login again');
      case 403:
        throw ForbiddenException('You don\'t have permission');
      case 404:
        throw NotFoundException('Resource not found');
      case 500:
        throw ServerException('Server error. Please try again later');
      default:
        throw ApiException(data['message'] ?? 'Unknown error');
    }
  } on SocketException {
    throw NetworkException('No internet connection');
  } catch (e) {
    rethrow;
  }
}
```

---

## 📱 Mobile Implementation Guide

### Complete Flutter Service Example

```dart
class RentifyApiService {
  static const String baseUrl = 'https://rentify-server-ge0f.onrender.com';
  static const String mlApiUrl = 'https://new-train-ml.onrender.com';
  
  String? _token;
  
  // Set token after login
  void setToken(String token) {
    _token = token;
  }
  
  // Get headers with auth
  Map<String, String> _getHeaders({bool includeAuth = false}) {
    final headers = {'Content-Type': 'application/json'};
    if (includeAuth && _token != null) {
      headers['Authorization'] = 'Bearer $_token';
    }
    return headers;
  }
  
  // 1. Fetch all properties
  Future<List<Property>> fetchProperties() async {
    final response = await http.get(
      Uri.parse('$baseUrl/api/properties'),
    );
    
    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      List<dynamic> propertiesJson = data['properties'] ?? data;
      return propertiesJson.map((json) => Property.fromJson(json)).toList();
    }
    
    throw Exception('Failed to load properties');
  }
  
  // 2. Create property
  Future<Property> createProperty(PropertyData propertyData) async {
    final response = await http.post(
      Uri.parse('$baseUrl/api/properties'),
      headers: _getHeaders(includeAuth: true),
      body: jsonEncode(propertyData.toJson()),
    );
    
    if (response.statusCode == 201) {
      final data = jsonDecode(response.body);
      return Property.fromJson(data['property']);
    }
    
    throw Exception('Failed to create property');
  }
  
  // 3. Upload images
  Future<List<String>> uploadImages(List<File> images) async {
    var request = http.MultipartRequest(
      'POST',
      Uri.parse('$baseUrl/upload'),
    );
    
    for (var image in images) {
      request.files.add(
        await http.MultipartFile.fromPath('images', image.path),
      );
    }
    
    var response = await request.send();
    
    if (response.statusCode == 200) {
      var responseData = await response.stream.bytesToString();
      var data = jsonDecode(responseData);
      return List<String>.from(data['urls']);
    }
    
    throw Exception('Failed to upload images');
  }
  
  // 4. ML Classification
  Future<int> predictCluster(double price, double lat, double lng) async {
    try {
      final response = await http.post(
        Uri.parse('$mlApiUrl/predict_kmeans'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'price': price,
          'latitude': lat,
          'longitude': lng,
        }),
      );
      
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        return data['cluster_id'];
      }
    } catch (e) {
      // Fallback to price-based
    }
    
    // Price-based fallback
    if (price > 0 && price <= 3000) return 0;
    if (price > 3000 && price <= 5000) return 1;
    return 2;
  }
  
  // 5. Login
  Future<LoginResponse> login(String email, String password) async {
    final response = await http.post(
      Uri.parse('$baseUrl/api/auth/login'),
      headers: _getHeaders(),
      body: jsonEncode({
        'email': email,
        'password': password,
      }),
    );
    
    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      _token = data['token'];
      return LoginResponse.fromJson(data);
    }
    
    throw Exception('Login failed');
  }
}
```

---

## 🗺️ Property Data Model

### Complete Property Model for Mobile

```dart
class Property {
  final String id;
  final String name;
  final String description;
  final double price;
  final Location location;
  final List<String> images;
  final String propertyType;
  final List<String> amenities;
  final String status;
  final String? phoneNumber;
  final Owner? postedBy;
  final Owner? createdBy;
  final DateTime createdAt;
  final int? cluster;

  Property({
    required this.id,
    required this.name,
    required this.description,
    required this.price,
    required this.location,
    required this.images,
    required this.propertyType,
    required this.amenities,
    required this.status,
    this.phoneNumber,
    this.postedBy,
    this.createdBy,
    required this.createdAt,
    this.cluster,
  });

  factory Property.fromJson(Map<String, dynamic> json) {
    return Property(
      id: json['_id'],
      name: json['name'],
      description: json['description'],
      price: json['price'].toDouble(),
      location: Location.fromJson(json['location']),
      images: List<String>.from(json['images'] ?? []),
      propertyType: json['propertyType'],
      amenities: List<String>.from(json['amenities'] ?? []),
      status: json['status'],
      phoneNumber: json['phoneNumber'],
      postedBy: json['postedBy'] != null && json['postedBy'] is Map
          ? Owner.fromJson(json['postedBy'])
          : null,
      createdBy: json['createdBy'] != null && json['createdBy'] is Map
          ? Owner.fromJson(json['createdBy'])
          : null,
      createdAt: DateTime.parse(json['createdAt']),
      cluster: json['cluster'],
    );
  }
}

class Location {
  final String address;
  final double latitude;
  final double longitude;

  Location({
    required this.address,
    required this.latitude,
    required this.longitude,
  });

  factory Location.fromJson(Map<String, dynamic> json) {
    return Location(
      address: json['address'],
      latitude: json['latitude'].toDouble(),
      longitude: json['longitude'].toDouble(),
    );
  }
}

class Owner {
  final String id;
  final String? username;
  final String? email;
  final String? fullName;
  final String? phoneNumber;
  final String? profilePicture;

  Owner({
    required this.id,
    this.username,
    this.email,
    this.fullName,
    this.phoneNumber,
    this.profilePicture,
  });

  factory Owner.fromJson(Map<String, dynamic> json) {
    return Owner(
      id: json['_id'],
      username: json['username'],
      email: json['email'],
      fullName: json['fullName'],
      phoneNumber: json['phoneNumber'],
      profilePicture: json['profilePicture'],
    );
  }
}
```

---

## 🔧 Testing Endpoints

### Using Postman

1. **Import Collection** - Create a Postman collection with all endpoints
2. **Set Environment Variables**:
   - `baseUrl`: `https://rentify-server-ge0f.onrender.com`
   - `token`: (Set after login)

### Using cURL

```bash
# Get all properties
curl https://rentify-server-ge0f.onrender.com/api/properties

# Login
curl -X POST https://rentify-server-ge0f.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Create property (with token)
curl -X POST https://rentify-server-ge0f.onrender.com/api/properties \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{"name":"Test Property","price":10000,...}'
```

---

## 📊 Summary

### Key Endpoints for Mobile

| Endpoint | Method | Auth Required | Purpose |
|----------|--------|---------------|---------|
| `/api/auth/register` | POST | No | Register user |
| `/api/auth/login` | POST | No | Login user |
| `/api/properties` | GET | No | Get all properties |
| `/api/properties/:id` | GET | No | Get single property |
| `/api/properties` | POST | Yes | Create property |
| `/api/properties/:id` | PUT | Yes | Update property |
| `/api/properties/:id` | DELETE | Yes | Delete property |
| `/api/properties/user/:userId` | GET | Yes | Get user's properties |
| `/api/properties/search` | GET | No | Search properties |
| `/upload` | POST | No | Upload images |
| `/predict_kmeans` | POST | No | ML classification |

---

## 🎯 Implementation Checklist

### For Mobile App Development:

- [ ] Create API service class
- [ ] Implement authentication (login/register)
- [ ] Implement property listing
- [ ] Implement property details view
- [ ] Implement property creation with image upload
- [ ] Implement property search/filter
- [ ] Implement ML clustering (optional)
- [ ] Implement user profile
- [ ] Implement messaging
- [ ] Add error handling
- [ ] Add loading states
- [ ] Add offline caching
- [ ] Add token refresh logic
- [ ] Test all endpoints

---

**Last Updated:** October 14, 2025  
**Maintained By:** Rentify Development Team  
**Contact:** support@rentify.com
