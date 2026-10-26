// 1.2 Log In, with the 1.3 error state. Log In -> 2.1 Home; Create an account -> 1.4 Sign Up.
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { AuthShell } from '../components/brand';
import { Banner, Button, Field, T } from '../components/ui';
import { authConfigured, logIn, takeNext, validEmail } from '../lib/auth';
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
    try { const done = await logIn(email, password); router.replace((done ? takeNext() : '/terms') as never); }
    catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.'); }
    finally { setBusy(false); }
  }
  return (
    <AuthShell title="Welcome back" subtitle="Log in to see your timetable."
      below={(
        <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center', justifyContent: 'center' }}>
          <T color={colors.textSecondary}>New to ScheduLens?</T>
          <Pressable onPress={() => router.push('/signup')} accessibilityRole="link" hitSlop={12}>
            <T v="label" color={colors.strawberryStrong}>Create an account</T>
          </Pressable>
        </View>
      )}>
      {!authConfigured && <Banner tone="warning" title="Sign-in is not set up" message="Add the Supabase URL and key to the app settings, then reload." />}
      {error && <Banner tone="error" title="Couldn’t sign you in" message={error} />}
      <Field label="Email" value={email} onChangeText={setEmail} error={emailErr} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
      <Field label="Password" value={password} onChangeText={setPassword} error={pwErr} secureTextEntry autoComplete="password" onSubmitEditing={submit} />
      <Pressable onPress={() => router.push('/reset-password')} accessibilityRole="button" hitSlop={12} style={{ alignSelf: 'flex-end' }}>
        <T v="captionStrong" color={colors.strawberryStrong}>Forgot password?</T>
      </Pressable>
      <Button label="Log In" onPress={submit} loading={busy} disabled={!authConfigured} />
    </AuthShell>
  );
}
