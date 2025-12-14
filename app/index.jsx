import { Redirect } from 'expo-router';

export default function Index() {
  // Redirect root to the main tabs group
  return <Redirect href="/(tabs)" />;
}
