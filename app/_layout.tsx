import { Slot } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useEffect } from 'react';
import { LogBox } from 'react-native';
import { useAuthStore } from '../store/authStore';
import WebSocketService from '../services/websocketService';

export default function RootLayout() {
  const { user, checkAuth } = useAuthStore();

  useEffect(() => {
    // Rehydrate auth state on app mount so persisted user/token are available
    (async () => {
      try {
        const ok = await checkAuth();
        if (ok) console.log('🔁 Auth rehydrated on app mount');
      } catch (e) {
        console.error('Error rehydrating auth on mount', e);
      }
    })();
  }, [checkAuth]);

  useEffect(() => {
    // Initialize WebSocket connection when user is authenticated
    if (user) {
      console.log('🔌 Initializing WebSocket connection for user:', user.name);
      if (!WebSocketService.isConnected()) {
        WebSocketService.connect();
      }
      return () => {
        console.log('🔌 Cleaning up WebSocket connection');
      };
    } else {
      if (WebSocketService.isConnected()) {
        console.log('🔌 User logged out, disconnecting WebSocket');
        WebSocketService.disconnect();
      }
    }
  }, [user]);

  return (
    <SafeAreaProvider>
      <Slot />
    </SafeAreaProvider>
  );
}

// Suppress third-party deprecation logs for SafeAreaView coming from older libs
LogBox.ignoreLogs(['SafeAreaView has been deprecated']);
