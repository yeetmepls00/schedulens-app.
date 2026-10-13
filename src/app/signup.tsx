// 1.4 Sign Up. Sign Up -> 1.5 Terms and Conditions.
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { AuthShell } from '../components/brand';
import { useState } from 'react';
import { Banner, Button, Field, T } from '../components/ui';
import { authConfigured, signUp, validEmail } from '../lib/auth';
import { colors, space } from '../theme/tokens';

export default function SignUp() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const longEnough = password.length >= 8;
  const hasNumber = /\d/.test(password);
  const errs = {
    name: !name.trim() ? 'Enter a username.' : undefined,
    email: !validEmail(email) ? 'Enter a valid email address, like name@example.com.' : undefined,
    password: !longEnough || !hasNumber ? 'Use at least 8 characters, including a number.' : undefined,
    confirm: confirm !== password || !confirm ? 'Passwords don’t match.' : undefined,
  };
  const ok = Object.values(errs).every((e) => !e);

  async function submit() {
    setTried(true); setError(null);
    if (!ok) return;
    setBusy(true);
    try {
      await signUp(name, email, password);
      router.push('/terms');
    } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.'); }
    finally { setBusy(false); }
  }
  const show = (k: keyof typeof errs) => (tried ? errs[k] : undefined);

  return (
    <AuthShell title="Create your account" subtitle="Free, and it takes under a minute." steps={0}
      below={(
        <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center', justifyContent: 'center' }}>
          <T color={colors.textSecondary}>Already have an account?</T>
          <Pressable onPress={() => router.replace('/login')} accessibilityRole="link" hitSlop={12}>
            <T v="label" color={colors.strawberryStrong}>Log in</T>
          </Pressable>
        </View>
      )}>
      {!authConfigured && <Banner tone="warning" title="Sign-up is not set up" message="Add the Supabase URL and key to the app settings, then reload." />}
      {error && <Banner tone="error" title="Couldn’t create your account" message={error} />}
      <Field label="Username" value={name} onChangeText={setName} error={show('name')} autoComplete="username" autoCapitalize="none" />
      <Field label="Email" value={email} onChangeText={setEmail} error={show('email')} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
      <Field label="Password" value={password} onChangeText={setPassword} error={show('password')} secureTextEntry autoComplete="new-password"
        helper={`${longEnough ? '✓' : '○'} At least 8 characters   ${hasNumber ? '✓' : '○'} Includes a number`} />
      <Field label="Confirm Password" value={confirm} onChangeText={setConfirm} error={show('confirm')} secureTextEntry autoComplete="new-password" />
      <Button label="Create account" onPress={submit} loading={busy} disabled={!authConfigured} />
      <T v="caption" center color={colors.textSecondary}>Next, we’ll email you a link to confirm your address.</T>
    </AuthShell>
  );
}
