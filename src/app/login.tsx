// 1.2 Log In, with the 1.3 error state. Log In -> 2.1 Home; Create an account -> 1.4 Sign Up.
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Banner, Button, Field, Screen, T } from '../components/ui';
import { authConfigured, logIn, validEmail } from '../lib/auth';
import { colors, space } from '../theme/tokens';

export default function LogIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailErr = tried && !validEmail(email) ? 'Enter a valid email address, like name@example.com.' : undefined;
  const pwErr = tried && !password ? 'Enter your password.' : undefined;

  async function submit() {
    setTried(true); setError(null);
    if (!validEmail(email) || !password) return;
    setBusy(true);
    try { await logIn(email, password); router.replace('/'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.'); }
    finally { setBusy(false); }
  }
  return (
    <Screen title={router.canGoBack() ? '' : undefined} back>
      <T v="welcome">Welcome Back!</T>
      <T color={colors.textSecondary}>Sign in to ScheduLens</T>
      {!authConfigured && <Banner tone="warning" title="Sign-in is not set up" message="Add the Supabase URL and key to the app settings, then reload." />}
      {error && <Banner tone="error" title="Couldn’t sign you in" message={error} />}
      <Field label="Email" value={email} onChangeText={setEmail} error={emailErr} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
      <Field label="Password" value={password} onChangeText={setPassword} error={pwErr} secureTextEntry autoComplete="password" onSubmitEditing={submit} />
      <Pressable onPress={() => router.push('/reset-password')} accessibilityRole="button" hitSlop={12} style={{ alignSelf: 'flex-end' }}>
        <T v="captionStrong" color={colors.strawberryStrong}>Forgot password?</T>
      </Pressable>
      <Button label="Log In" onPress={submit} loading={busy} disabled={!authConfigured} />
      <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
        <T color={colors.textSecondary}>New to ScheduLens?</T>
        <Pressable onPress={() => router.push('/signup')} accessibilityRole="link" hitSlop={12}>
          <T v="label" color={colors.strawberryStrong}>Create an account</T>
        </Pressable>
      </View>
    </Screen>
  );
}
