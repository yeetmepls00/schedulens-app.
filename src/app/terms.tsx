// 1.5 Terms and Conditions. Continue -> 2.1 Home (or the page the person first
// tried to open). Continue turns on only after the email is confirmed and the box is ticked.
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Banner, Button, Card, Checkbox, Icon, Screen, T, type IconName } from '../components/ui';
import { acceptTermsAndFinish, checkConfirmed, hasPendingSignUp, resendConfirmation, takeNext, useVerified } from '../lib/auth';
import { colors, space } from '../theme/tokens';

const ITEMS: [IconName, string, string][] = [
  ['calendar-outline', 'Schedule Information', 'How we collect and use your schedule data'],
  ['sync-outline', 'Calendar Synchronization', 'How we connect with your calendar accounts'],
  ['people-outline', 'Group Sharing', 'Only free and busy times are shared'],
  ['shield-checkmark-outline', 'Privacy', 'How we protect your information'],
  ['warning-outline', 'Limitation of Liability', 'How we handle service availability'],
];

export default function Terms() {
  const verified = useVerified();
  const [agree, setAgree] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  // While the email is unconfirmed, check every few seconds and whenever this
  // tab comes back into view or the confirmation tab says it is done, so this
  // page continues by itself in the same tab.
  useEffect(() => {
    if (verified) return;
    const check = () => { checkConfirmed().catch(() => {}); };
    const timer = setInterval(check, 4000);
    const onVisible = () => { if (typeof document === 'undefined' || document.visibilityState === 'visible') check(); };
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisible);
    };
  }, [verified]);

  // The confirmation tab asks whether this tab is waiting; answer so it can
  // tell the person to come back here instead of opening the app twice.
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel('schedulens-auth');
    channel.onmessage = (m) => { if (m.data === 'confirmed') { channel.postMessage('here'); checkConfirmed().catch(() => {}); } };
    return () => channel.close();
  }, []);

  function finish() {
    try { acceptTermsAndFinish(); } catch (e) { setNote(e instanceof Error ? e.message : String(e)); return; }
    const next = takeNext();
    if (router.canDismiss()) router.dismissAll();
    router.replace(next as never);
  }
  async function resend() {
    try { await resendConfirmation(); setNote('We sent a new confirmation email.'); }
    catch (e) { setNote(e instanceof Error ? e.message : String(e)); }
  }
  return (
    <Screen title="Terms and Conditions" back>
      {!verified && (
        <Banner tone="warning" title="Confirm your email to continue"
          message={hasPendingSignUp()
            ? 'We sent you a link. Open it, and this page continues by itself. Continue stays off until your email is confirmed.'
            : 'Open the link in the email we sent you, then log in.'} />
      )}
      {!verified && hasPendingSignUp() && (
        <Pressable onPress={resend} accessibilityRole="button" hitSlop={12} style={{ alignSelf: 'flex-start' }}>
          <T v="captionStrong" color={colors.strawberryStrong}>Resend confirmation email</T>
        </Pressable>
      )}
      {!verified && !hasPendingSignUp() && (
        <Pressable onPress={() => router.replace('/login')} accessibilityRole="button" hitSlop={12} style={{ alignSelf: 'flex-start' }}>
          <T v="captionStrong" color={colors.strawberryStrong}>Go to Log In</T>
        </Pressable>
      )}
      {verified && <Banner tone="matcha" title="Email confirmed" message="Thanks! Tick the box and tap Continue." />}
      {note && <T v="caption" color={colors.textSecondary}>{note}</T>}
      <T color={colors.textSecondary}>Please review how ScheduLens handles your schedule before you continue.</T>
      <Card style={{ gap: space.md }}>
        {ITEMS.map(([icon, title, sub]) => (
          <View key={title} style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.header, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={icon} size={20} color={colors.strawberry} />
            </View>
            <View style={{ flex: 1 }}>
              <T v="label">{title}</T>
              <T v="caption" color={colors.textSecondary}>{sub}</T>
            </View>
          </View>
        ))}
      </Card>
      <Checkbox label="I have read and agree to the Terms" on={agree} onPress={() => setAgree(!agree)} />
      <Button label="Continue" onPress={finish} disabled={!agree || !verified} />
      {(!agree || !verified) && <T v="caption" color={colors.textSecondary}>
        {!verified ? 'Continue turns on after you confirm your email and tick the box.' : 'Continue turns on after you tick the box.'}
      </T>}
    </Screen>
  );
}
