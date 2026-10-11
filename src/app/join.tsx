// 4.3 Join Group. Shows the group and exactly what you will share before you join.
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Banner, Button, Card, Icon, Screen, T } from '../components/ui';
import { getSetting, useEvents } from '../data/db';
import { joinGroup, previewGroup, saveGroups, savedGroups } from '../lib/groups';
import { colors, space } from '../theme/tokens';

export default function Join() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const events = useEvents();
  const name = getSetting('displayName', '');
  const [info, setInfo] = useState<{ name: string; memberCount: number; expiresAt: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    previewGroup(code ?? '', name).then(setInfo).catch((e) => setError(e instanceof Error ? e.message : 'That code was not found.'));
  }, [code]); // eslint-disable-line react-hooks/exhaustive-deps

  async function join() {
    setBusy(true); setError(null);
    try {
      const g = await joinGroup(code ?? '', name, events);
      saveGroups([...savedGroups().filter((x) => x.id !== g.id), g]);
      router.dismissAll();
      router.replace({ pathname: '/groups', params: { open: g.id } });
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not join. Please try again.'); }
    finally { setBusy(false); }
  }

  return (
    <Screen title="Join Group" back footer={
      <View style={{ flexDirection: 'row', gap: space.md }}>
        <Button kind="secondary" label="Decline" style={{ flex: 1 }} onPress={() => router.back()} />
        <Button label="Join Group" style={{ flex: 1 }} loading={busy} disabled={!info} onPress={join} />
      </View>}>
      {error && <Banner tone="error" title="Can’t join" message={error} />}
      {!info && !error && <T center color={colors.textSecondary}>Looking up code {code}…</T>}
      {info && (
        <>
          <View style={{ alignItems: 'center', gap: space.sm }}>
            <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.matchaSoft, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="people" size={36} color={colors.matchaStrong} />
            </View>
            <T v="section">{info.name}</T>
            <T v="caption" color={colors.textSecondary}>{info.memberCount} {info.memberCount === 1 ? 'member' : 'members'} · code expires {new Date(info.expiresAt).toLocaleDateString()}</T>
          </View>
          <T v="cardTitle">You will share</T>
          <Card style={{ gap: space.md }}>
            <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}><Icon name="checkmark-circle" color={colors.success} /><T style={{ flex: 1 }}>When you are busy or free</T></View>
            <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}><Icon name="close-circle" color={colors.error} /><T style={{ flex: 1 }}>Event titles, rooms, instructors</T></View>
          </Card>
          <T v="caption" color={colors.textSecondary}>You can update or stop sharing anytime by leaving the group.</T>
        </>
      )}
    </Screen>
  );
}
