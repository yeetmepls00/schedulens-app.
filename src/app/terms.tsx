// 1.5 Terms and Conditions. Continue -> 2.1 Home (or the page the person first
// tried to open). Continue turns on only after the email is confirmed and the box is ticked.
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { AuthShell } from '../components/brand';
import { Button, Checkbox, Field, Icon, T, type IconName } from '../components/ui';
import { acceptTermsAndFinish, checkConfirmed, confirmWithCode, hasPendingSignUp, pendingEmail, resendConfirmation, takeNext, useVerified } from '../lib/auth';
import { colors, space } from '../theme/tokens';

const ITEMS: [IconName, string, string][] = [
  ['calendar-outline', 'Schedule Information', 'How we collect and use your schedule data'],
  ['download-outline', 'Calendar Export', 'Your timetable leaves ScheduLens only as a file you export'],
  ['people-outline', 'Group Sharing', 'Only free and busy times are shared'],
  ['shield-checkmark-outline', 'Privacy', 'How we protect your information'],
  ['warning-outline', 'Limitation of Liability', 'How we handle service availability'],
];

export default function Terms() {
  const verified = useVerified();
  const [agree, setAgree] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [codeBusy, setCodeBusy] = useState(false);
  async function useCode() {
    setCodeBusy(true); setNote(null);
    try { await confirmWithCode(code); } catch (e) { setNote(e instanceof Error ? e.message : String(e)); }
    finally { setCodeBusy(false); }
  }

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
    <AuthShell title={verified ? 'One last step' : 'Check your inbox'}
      subtitle={verified ? 'Your email is confirmed. Review the Terms to finish.' : undefined} steps={verified ? 2 : 1}>
      {!verified && (
        <View style={{ alignItems: 'center', gap: space.md }}>
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.header, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="mail-unread-outline" size={30} color={colors.strawberryStrong} />
          </View>
          <T center>
            {hasPendingSignUp()
              ? <>We sent a confirmation link to <T v="label">{pendingEmail()}</T>. Tap the link, or type the code from the email below. This page moves on by itself.</>
              : 'Open the confirmation link in the email we sent you, then log in.'}
          </T>
          {hasPendingSignUp() ? (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                <ActivityIndicator size="small" color={colors.strawberryStrong} />
                <T v="caption" color={colors.textSecondary}>Waiting for confirmation…</T>
              </View>
              <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'flex-end', alignSelf: 'stretch' }}>
                <View style={{ flex: 1 }}>
                  <Field label="Code from the email" value={code} onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 8))} keyboardType="number-pad" placeholder="123456" autoComplete="one-time-code" />
                </View>
                <Button label="Confirm" loading={codeBusy} disabled={code.length < 6} onPress={useCode} />
              </View>
              <View style={{ flexDirection: 'row', gap: space.lg }}>
                <Pressable onPress={resend} accessibilityRole="button" hitSlop={12}>
                  <T v="captionStrong" color={colors.strawberryStrong}>Resend email</T>
                </Pressable>
                <Pressable onPress={() => router.replace('/signup')} accessibilityRole="button" hitSlop={12}>
                  <T v="captionStrong" color={colors.strawberryStrong}>Use a different email</T>
                </Pressable>
              </View>
            </>
          ) : (
            <Button kind="secondary" label="Go to Log In" onPress={() => router.replace('/login')} />
          )}
          {note && <T v="caption" center color={colors.textSecondary}>{note}</T>}
          <View style={{ height: 1, alignSelf: 'stretch', backgroundColor: colors.border }} />
        </View>
      )}
      {verified && note && <T v="caption" color={colors.textSecondary}>{note}</T>}
      <T v="cardTitle">Terms and Conditions</T>
      <View style={{ gap: space.md }}>
        {ITEMS.map(([icon, title, sub]) => (
          <View key={title} style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.header, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={icon} size={18} color={colors.strawberry} />
            </View>
            <View style={{ flex: 1 }}>
              <T v="label">{title}</T>
              <T v="caption" color={colors.textSecondary}>{sub}</T>
            </View>
          </View>
        ))}
      </View>
      <Checkbox label="I have read and agree to the Terms" on={agree} onPress={() => setAgree(!agree)} />
      <Button label="Continue" onPress={finish} disabled={!agree || !verified} />
      {(!agree || !verified) && <T v="caption" color={colors.textSecondary}>
        {!verified ? 'Continue turns on after you confirm your email and tick the box.' : 'Continue turns on after you tick the box.'}
      </T>}
    </AuthShell>
  );
}
