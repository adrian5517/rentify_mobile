import { Stack } from "expo-router";
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import WebSocketService from '../services/websocketService';

export default function RootLayout() {
  const { user } = useAuthStore();

  useEffect(() => {
    // Initialize WebSocket connection when user is authenticated
    if (user) {
      console.log('🔌 Initializing WebSocket connection for user:', user.name);
      
      // Connect WebSocket
      if (!WebSocketService.isConnected()) {
        WebSocketService.connect();
      }

      // Cleanup on unmount or logout
      return () => {
        console.log('🔌 Cleaning up WebSocket connection');
        // Don't disconnect immediately - let it stay connected for the session
        // WebSocketService.disconnect();
      };
    } else {
      // Disconnect when user logs out
      if (WebSocketService.isConnected()) {
        console.log('🔌 User logged out, disconnecting WebSocket');
        WebSocketService.disconnect();
      }
    }
  }, [user]);

  return (
    <SafeAreaProvider>
      <Stack screenOptions={{headerShown: false}}>
        <Stack.Screen name="index" options={{title:"Home"}}/>
      </Stack>
    </SafeAreaProvider>
  );
}
