import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Alert, 
  Image, 
  ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store/authStore';
import normalizeAvatar from '../../utils/normalizeAvatar';
import { useRouter } from 'expo-router';
import COLORS from '@/constant/colors';
import { API_URL as BASE_API_URL } from '@/constant/api';
import { Ionicons, MaterialIcons, AntDesign } from '@expo/vector-icons';

export default function Profile() {
  const { logout, user } = useAuthStore();
  const router = useRouter();
  // Debug user and defensively resolve profile picture (string or object shapes)
  console.log('Profile screen user:', user);
  const DEFAULT_AVATAR = 'https://api.dicebear.com/7.x/avataaars/png?seed=default';

  const resolveProfilePicture = (u) => {
    if (!u) return DEFAULT_AVATAR;
    const cand = u.profilePicture || u.profile_picture || u.avatar || u.picture || null;
    if (!cand) return DEFAULT_AVATAR;
    if (typeof cand === 'string') {
      let avatar = cand;
      if (avatar.includes('api.dicebear.com') && avatar.includes('/svg?')) avatar = avatar.replace('/svg?', '/png?');
      if (!avatar.startsWith('http')) avatar = `${BASE_API_URL}${avatar.startsWith('/') ? avatar : `/${avatar}`}`;
      return avatar;
    }
    if (typeof cand === 'object') {
      const objUrl = cand.url || cand.path || cand.secure_url || cand.location || cand.uri || (Array.isArray(cand) && cand[0]) || null;
      if (!objUrl) return DEFAULT_AVATAR;
      let avatar = objUrl;
      if (avatar.includes('api.dicebear.com') && avatar.includes('/svg?')) avatar = avatar.replace('/svg?', '/png?');
      if (!avatar.startsWith('http')) avatar = `${BASE_API_URL}${avatar.startsWith('/') ? avatar : `/${avatar}`}`;
      return avatar;
    }
    return DEFAULT_AVATAR;
  };

  const profilePicture = resolveProfilePicture(user);

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
              Alert.alert('Logout Error', error.message || 'Failed to logout. Please try again.');
            }
          },
        },
      ],
      { cancelable: false }
    );
  };

  const ProfileActionButton = ({ icon, title, onPress }) => (
    <TouchableOpacity style={styles.actionButton} onPress={onPress}>
      <View style={styles.actionButtonContent}>
        {icon}
        <Text style={styles.actionButtonText}>{title}</Text>
        <Ionicons name="chevron-forward" size={24} color={COLORS.gray} />
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <TouchableOpacity onPress={() => {/* TODO: Add image picker */}}>
            <Image 
              source={{ uri: profilePicture }} 
              style={styles.profileImage} 
            />
            <View style={styles.editProfileIcon}>
              <AntDesign name="edit" size={16} color={COLORS.white} />
            </View>
          </TouchableOpacity>
          <Text style={styles.profileName}>{user?.username || 'User Name'}</Text>
          <Text style={styles.profileEmail}>{user?.email || 'user@example.com'}</Text>
        </View>

        {/* Profile Actions */}
        <View style={styles.profileActions}>
          <ProfileActionButton 
            icon={<MaterialIcons name="house" size={24} color={COLORS.primary} />}
            title="My Listings"
            onPress={() => router.push('/(tabs)/List')}
          />
          <ProfileActionButton 
            icon={<Ionicons name="heart-outline" size={24} color={COLORS.primary} />}
            title="Saved Properties"
            onPress={() => router.push('/saved-properties')}
          />
          <ProfileActionButton 
            icon={<Ionicons name="settings-outline" size={24} color={COLORS.primary} />}
            title="Settings"
            onPress={() => router.push('/settings')}
          />
        </View>

        {/* Logout Button */}
        <TouchableOpacity 
          style={styles.logoutButton} 
          onPress={handleLogout}
        >
          <Ionicons 
            name="log-out-outline" 
            size={24} 
            color={COLORS.white} 
          />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 30,
    backgroundColor: COLORS.white,
    marginBottom: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: COLORS.primary,
  },
  editProfileIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: COLORS.primary,
    borderRadius: 15,
    padding: 5,
  },
  profileName: {
    fontSize: 22,
    fontWeight: 'bold',
    marginTop: 15,
    color: COLORS.dark,
  },
  profileEmail: {
    fontSize: 16,
    color: COLORS.gray,
  },
  profileActions: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  actionButton: {
    backgroundColor: COLORS.white,
    borderRadius: 10,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  actionButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
  },
  actionButtonText: {
    flex: 1,
    marginLeft: 15,
    fontSize: 16,
    color: COLORS.dark,
  },
  logoutButton: {
    backgroundColor: COLORS.primary,
    padding: 15,
    marginHorizontal: 20,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  logoutText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});
