import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { dbReady } from '../data/db';

export default function RootLayout() {
  const [isMounted, setIsMounted] = useState(false);

  // Wait until local storage is open before showing any screen.
  useEffect(() => {
    dbReady.then(() => setIsMounted(true));
  }, []);

  if (!isMounted) {
    return null;
  }

  return (
    <SafeAreaProvider style={{ flex: 1 }}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }} />
    </SafeAreaProvider>
  );
}