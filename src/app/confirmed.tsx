// Opened by the link in the confirmation email. Confirms the sign-in, then
// tells the person to go back to where they signed up (that page carries on by
// itself), with an option to continue in this browser instead.
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { AuthShell } from '../components/brand';
import { Banner, Button, T } from '../components/ui';
import { getSetting } from '../data/db';
import { openConfirmLink, rememberNext } from '../lib/auth';
import { colors } from '../theme/tokens';

export default function Confirmed() {
  const { next } = useLocalSearchParams<{ next?: string }>();
  const [state, setState] = useState<'checking' | 'otherTab' | 'done' | 'error'>('checking');
  const [error, setError] = useState('');

  const continueHere = () => {
    // Terms not accepted on this device yet: show them first; Terms then opens `next`.
    router.replace((getSetting('termsAcceptedAt', '') ? (next && next.startsWith('/') && !next.startsWith('//') ? next : '/') : '/terms') as never);
  };
  useEffect(() => {
    if (next) rememberNext(next);
    openConfirmLink().then(() => {
      // Ask whether a ScheduLens tab is waiting on the Terms page.
      if (typeof BroadcastChannel === 'undefined') return setState('done');
      const channel = new BroadcastChannel('schedulens-auth');
      let answered = false;
      channel.onmessage = (m) => { if (m.data === 'here') { answered = true; setState('otherTab'); channel.close(); } };
      channel.postMessage('confirmed');
      setTimeout(() => { if (!answered) { channel.close(); setState('done'); } }, 1200);
    }, (e) => { setError(e instanceof Error ? e.message : String(e)); setState('error'); });
  }, [next]);

  return (
    <AuthShell title="Confirming your email" back={false} steps={1}>
      {state === 'checking' && <T color={colors.textSecondary}>Confirming your email…</T>}
      {state === 'otherTab' && (
        <>
          <Banner tone="matcha" title="Email confirmed" message="Your other ScheduLens tab has continued for you. You can close this tab." />
          <Button label="Continue here instead" onPress={() => router.replace('/terms')} />
        </>
      )}
      {state === 'done' && (
        <>
          <Banner tone="matcha" title="Email confirmed 🎉" message="Go back to ScheduLens where you signed up (the app or the browser tab). It continues by itself, so you can close this page." />
          <Button label="Close this page" onPress={() => { try { window.close(); } catch {} }} />
          <Button kind="text" label="Continue in this browser instead" onPress={continueHere} />
        </>
      )}
      {state === 'error' && (
        <>
          <Banner tone="error" title="Couldn’t confirm your email" message={error} />
          <Button label="Go to Log In" onPress={() => router.replace('/login')} />
        </>
      )}
    </AuthShell>
  );
}
