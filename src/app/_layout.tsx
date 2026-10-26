import { Redirect, router, Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { dbReady } from '../data/db';
import { recordVersion } from '../lib/update';
import { isPublicPath, loadAuth, rememberNext, rememberResetLink, useSignedIn } from '../lib/auth';

// Supabase may send a reset link to the site's home page instead of
// /new-password (it falls back to the Site URL). Catch the recovery sign-in in
// the address and open the New Password screen before anything else loads.
const wantsReset = typeof window !== 'undefined' && !!window.location
  && /type=recovery/.test(window.location.hash + window.location.search)
  && window.location.pathname !== '/new-password';
if (wantsReset) rememberResetLink(window.location.hash, window.location.search);

export default function RootLayout() {
  const [isMounted, setIsMounted] = useState(false);
  const [failed, setFailed] = useState(false);

  // Wait until local storage is open before showing any screen.
  useEffect(() => {
    dbReady.then(() => { recordVersion(); return loadAuth(); }).then(() => setIsMounted(true), (e) => { console.error('Storage failed to open', e); setFailed(true); });
  }, []);

  useEffect(() => {
    if (isMounted && wantsReset) setTimeout(() => router.replace('/new-password'), 0);
  }, [isMounted]);

  // If storage can't open (very old or locked-down browsers), say so instead
  // of showing a blank page.
  if (failed) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#fff' }}>
        <Text style={{ fontSize: 20, fontWeight: '700', marginBottom: 8, textAlign: 'center' }}>Open ScheduLens in your browser</Text>
        <Text style={{ fontSize: 15, color: '#555', textAlign: 'center' }}>
          This browser can't store your schedule. Open the link in Chrome, Safari, Edge, or Firefox.
          If you are inside another app, tap ⋮ or the share icon, then "Open in browser".
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
      <Guard />
    </SafeAreaProvider>
  );
}

// Every page except Welcome, Log In, Sign Up, Terms, password reset, Help, and
// the confirmation page needs a signed-in account with a confirmed email.
// The page asked for is remembered and opened after signing in.
function Guard() {
  const path = usePathname();
  const signedIn = useSignedIn();
  if (signedIn || isPublicPath(path) || wantsReset) return null;
  const full = typeof window !== 'undefined' && window.location ? window.location.pathname + window.location.search : path;
  rememberNext(full);
  return <Redirect href="/welcome" />;
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
