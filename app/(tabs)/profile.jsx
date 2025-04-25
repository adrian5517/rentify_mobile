import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import React from 'react';
import { useAuthStore } from '@/store/authStore';
import { useRouter } from 'expo-router';
import COLORS from '@/constant/colors';
import { Ionicons } from '@expo/vector-icons';

export default function Profile() {
  const { logout } = useAuthStore();
  const router = useRouter();

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();
              setTimeout(() => {
                router.replace('/(auth)');
              }, 100);
            } catch (error) {
              console.error('Logout error:', error);
            }
          },
        },
      ],
      { cancelable: false }
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profile</Text>
      
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={24} color={COLORS.white} />
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  logoutButton: {
    backgroundColor: COLORS.primary,
    padding: 15,
    
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: '180%',
  },
  logoutText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});
