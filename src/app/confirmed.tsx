// Opened by the link in the confirmation email. Confirms the sign-in, then
// either lets the ScheduLens tab that was waiting carry on, or continues here.
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Banner, Button, Screen, T } from '../components/ui';
import { getSetting } from '../data/db';
import { openConfirmLink, rememberNext } from '../lib/auth';
import { colors } from '../theme/tokens';

export default function Confirmed() {
  const { next } = useLocalSearchParams<{ next?: string }>();
  const [state, setState] = useState<'checking' | 'otherTab' | 'error'>('checking');
  const [error, setError] = useState('');

  useEffect(() => {
    if (next) rememberNext(next);
    const continueHere = () => {
      // Terms not accepted on this device yet: show them first; Terms then opens `next`.
      router.replace((getSetting('termsAcceptedAt', '') ? (next && next.startsWith('/') && !next.startsWith('//') ? next : '/') : '/terms') as never);
    };
    openConfirmLink().then(() => {
      // Ask whether a ScheduLens tab is waiting on the Terms page.
      if (typeof BroadcastChannel === 'undefined') return continueHere();
      const channel = new BroadcastChannel('schedulens-auth');
      let answered = false;
      channel.onmessage = (m) => { if (m.data === 'here') { answered = true; setState('otherTab'); channel.close(); } };
      channel.postMessage('confirmed');
      setTimeout(() => { if (!answered) { channel.close(); continueHere(); } }, 1200);
    }, (e) => { setError(e instanceof Error ? e.message : String(e)); setState('error'); });
  }, [next]);

  return (
    <Screen title="Confirm your email">
      {state === 'checking' && <T color={colors.textSecondary}>Confirming your email…</T>}
      {state === 'otherTab' && (
        <>
          <Banner tone="matcha" title="Email confirmed" message="Your other ScheduLens tab has continued for you. You can close this tab." />
          <Button label="Continue here instead" onPress={() => router.replace('/terms')} />
        </>
      )}
      {state === 'error' && (
        <>
          <Banner tone="error" title="Couldn’t confirm your email" message={error} />
          <Button label="Go to Log In" onPress={() => router.replace('/login')} />
        </>
      )}
    </Screen>
  );
}
