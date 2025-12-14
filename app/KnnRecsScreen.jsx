import React from 'react';
import { View, Text } from 'react-native';

// Deprecated: recommendations are now shown on Home (/(tabs)/index). This file kept as a harmless stub.
export default function KnnRecsScreen() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <Text style={{ fontWeight: '700' }}>Recommendations moved to Home</Text>
      <Text style={{ marginTop: 8, color: '#666' }}>Open the app Home and use Nearby or Great value deals.</Text>
    </View>
  );
}
