// 1.4 Sign Up. Sign Up -> 1.5 Terms and Conditions.
import { router } from 'expo-router';
import { useState } from 'react';
import { Banner, Button, Checkbox, Field, Screen, T } from '../components/ui';
import { authConfigured, signUp, validEmail } from '../lib/auth';
import { colors } from '../theme/tokens';

export default function SignUp() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [agree, setAgree] = useState(false);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const longEnough = password.length >= 8;
  const hasNumber = /\d/.test(password);
  const errs = {
    name: !name.trim() ? 'Enter your full name.' : undefined,
    email: !validEmail(email) ? 'Enter a valid email address, like name@example.com.' : undefined,
    password: !longEnough || !hasNumber ? 'Use at least 8 characters, including a number.' : undefined,
    confirm: confirm !== password || !confirm ? 'Passwords don’t match.' : undefined,
  };
  const ok = Object.values(errs).every((e) => !e) && agree;

  async function submit() {
    setTried(true); setError(null);
    if (!ok) return;
    setBusy(true);
    try {
      const needsConfirm = await signUp(name, email, password);
      router.push({ pathname: '/terms', params: needsConfirm ? { confirm: '1' } : {} });
    } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.'); }
    finally { setBusy(false); }
  }
  const show = (k: keyof typeof errs) => (tried ? errs[k] : undefined);

  return (
    <Screen title="" back>
      <T v="welcome">Create your account</T>
      {!authConfigured && <Banner tone="warning" title="Sign-up is not set up" message="Add the Supabase URL and key to the app settings, then reload." />}
      {error && <Banner tone="error" title="Couldn’t create your account" message={error} />}
      <Field label="Full name" value={name} onChangeText={setName} error={show('name')} autoComplete="name" />
      <Field label="Email" value={email} onChangeText={setEmail} error={show('email')} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
      <Field label="Password" value={password} onChangeText={setPassword} error={show('password')} secureTextEntry autoComplete="new-password"
        helper={`${longEnough ? '✓' : '○'} At least 8 characters   ${hasNumber ? '✓' : '○'} Includes a number`} />
      <Field label="Confirm Password" value={confirm} onChangeText={setConfirm} error={show('confirm')} secureTextEntry autoComplete="new-password" />
      <Checkbox label="I agree to the Terms and Conditions" on={agree} onPress={() => setAgree(!agree)} />
      {tried && !agree && <T v="caption" color={colors.error}>Tick the box to continue.</T>}
      <Button label="Sign Up" onPress={submit} loading={busy} disabled={!authConfigured} />
    </Screen>
  );
}
