// 1.7 New Password. The reset email links here; the link carries a one-time
// sign-in that lets the person choose a new password.
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Banner, Button, Field, Screen, T } from '../components/ui';
import { finishPasswordReset, openResetLink } from '../lib/auth';
import { colors } from '../theme/tokens';

export default function NewPassword() {
  const [ready, setReady] = useState<'checking' | 'ok' | string>('checking');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => { openResetLink().then(() => setReady('ok'), (e) => setReady(e instanceof Error ? e.message : 'This link is invalid.')); }, []);

  const pwError = password.length < 8 || !/\d/.test(password) ? 'Use at least 8 characters, including a number.' : undefined;
  const matchError = confirm !== password ? 'Passwords don’t match.' : undefined;

  async function save() {
    setTried(true); setError(null);
    if (pwError || matchError) return;
    setBusy(true);
    try { await finishPasswordReset(password); setDone(true); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not change your password.'); }
    finally { setBusy(false); }
  }

  return (
    <Screen title="">
      <T v="welcome">Choose a new password</T>
      {ready === 'checking' && <T color={colors.textSecondary}>Checking your reset link…</T>}
      {ready !== 'checking' && ready !== 'ok' && (
        <>
          <Banner tone="error" title="This link can’t be used" message={ready} />
          <Button label="Send a new link" onPress={() => router.replace('/reset-password')} />
        </>
      )}
      {ready === 'ok' && !done && (
        <>
          {error && <Banner tone="error" title="Couldn’t change your password" message={error} />}
          <Field label="New password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" error={tried ? pwError : undefined} />
          <Field label="Confirm new password" value={confirm} onChangeText={setConfirm} secureTextEntry autoComplete="new-password" error={tried ? matchError : undefined} />
          <Button label="Save new password" onPress={save} loading={busy} />
        </>
      )}
      {done && (
        <>
          <Banner tone="success" title="Password changed" message="Log in with your new password." />
          <Button label="Go to Log In" onPress={() => router.replace('/login')} />
        </>
      )}
    </Screen>
  );
}
