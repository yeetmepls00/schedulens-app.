import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { dbReady } from '../data/db';

export default function RootLayout() {
  const [isMounted, setIsMounted] = useState(false);
  const [failed, setFailed] = useState(false);

  // Wait until local storage is open before showing any screen.
  useEffect(() => {
    dbReady.then(() => setIsMounted(true), () => setFailed(true));
  }, []);

  // Some in-app browsers (Messenger, Facebook, Instagram) block the storage the
  // web version needs. Say so instead of showing a blank page.
  if (failed) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#fff' }}>
        <Text style={{ fontSize: 20, fontWeight: '700', marginBottom: 8, textAlign: 'center' }}>Open ScheduLens in your browser</Text>
        <Text style={{ fontSize: 15, color: '#555', textAlign: 'center' }}>
          This browser can't store your schedule. Open the link in Chrome or Safari instead
          (tap ⋮ or the share icon, then "Open in browser").
        </Text>
      </View>
    );
  }

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
// If a screen crashes, show what went wrong instead of a blank page, so the
// problem can be reported and fixed.
export function ErrorBoundary({ error, retry }: { error: Error; retry: () => Promise<void> }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#fff' }}>
      <Text style={{ fontSize: 20, fontWeight: '700', marginBottom: 8, textAlign: 'center' }}>Something went wrong</Text>
      <Text selectable style={{ fontSize: 13, color: '#555', textAlign: 'center', marginBottom: 16 }}>{String(error?.message ?? error)}</Text>
      <Text onPress={retry} style={{ fontSize: 16, color: '#C0395A', fontWeight: '600' }}>Try again</Text>
    </View>
  );
}
