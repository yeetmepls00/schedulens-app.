// 1.6 Reset Password. Opened from "Forgot password?" on 1.2 Log In.
import { router } from 'expo-router';
import { goBack } from '../lib/nav';
import { useState } from 'react';
import { AuthShell } from '../components/brand';
import { Banner, Button, Field } from '../components/ui';
import { sendPasswordReset, validEmail } from '../lib/auth';

export default function ResetPassword() {
  const [email, setEmail] = useState('');
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function send() {
    setTried(true); setError(null);
    if (!validEmail(email)) return;
    setBusy(true);
    try { await sendPasswordReset(email); setSent(true); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not send the reset email.'); }
    finally { setBusy(false); }
  }
  return (
    <AuthShell title="Reset password" subtitle="Enter the email you signed up with. We’ll send you a link to choose a new password."
      below={<Button kind="text" label="Back to Log In" onPress={() => goBack('/login')} />}>
      {error && <Banner tone="error" title="Couldn’t send the link" message={error} />}
      <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email"
        error={tried && !validEmail(email) ? 'Enter a valid email address, like name@example.com.' : undefined} />
      <Button label="Send reset link" onPress={send} loading={busy} />
      {sent && <Banner tone="success" title="Check your email" message="If an account exists for this email, a reset link is on its way." />}
    </AuthShell>
  );
}
