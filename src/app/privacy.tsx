// 4.6 Data & Privacy: active group shares, export, download your data, delete account.
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Banner, Button, Card, Icon, Screen, T, type IconName } from '../components/ui';
import { getSetting, useEvents, useFiles } from '../data/db';
import { deleteAccount } from '../lib/auth';
import { confirm } from '../lib/confirm';
import { exportIcs, MissingTermDatesError, shareText } from '../lib/exportIcs';
import { groupsConfigured, leaveGroup, saveGroups, savedGroups, type Group } from '../lib/groups';
import { colors, space } from '../theme/tokens';

export default function Privacy() {
  const events = useEvents();
  const files = useFiles();
  const [groups, setGroups] = useState<Group[]>(savedGroups);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function revoke(g: Group) {
    setError(null);
    try { await leaveGroup(g.id); const rest = groups.filter((x) => x.id !== g.id); saveGroups(rest); setGroups(rest); setDone(`You left ${g.name}. Your busy times were removed from it.`); }
    catch { setError('Could not stop sharing. Check your connection and try again.'); }
  }
  async function doExport() {
    setError(null);
    try { await exportIcs(events); } catch (e) { setError(e instanceof MissingTermDatesError ? e.message : 'Export failed. Please try again.'); }
  }
  async function download() {
    const data = { exportedAt: new Date().toISOString(), displayName: getSetting('displayName', ''), events, files: files.map(({ uri, ...f }) => f), groups: groups.map(({ name, code }) => ({ name, code })) };
    await shareText('schedulens-data.json', JSON.stringify(data, null, 2), 'application/json');
  }
  function remove() {
    confirm('Delete account?', 'This removes your account, all schedules, and your shared busy times from every group. It cannot be undone.', [
      { text: 'Delete account', destructive: true, onPress: async () => {
        try { await deleteAccount(); router.dismissAll(); router.replace('/welcome'); }
        catch (e) { setError(e instanceof Error ? e.message : 'Could not delete your account.'); }
      } },
    ]);
  }

  const Row = ({ icon, title, sub, onPress }: { icon: IconName; title: string; sub: string; onPress: () => void }) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
      <Icon name={icon} color={colors.strawberry} />
      <View style={{ flex: 1 }}><T v="label">{title}</T><T v="caption" color={colors.textSecondary}>{sub}</T></View>
      <Button kind="text" label="Open" onPress={onPress} />
    </View>
  );

  return (
    <Screen title="Data & Privacy" back>
      {error && <Banner tone="error" title="Something went wrong" message={error} />}
      {done && <Banner tone="success" title="Done" message={done} />}
      <T v="cardTitle">Active group shares</T>
      <Card style={{ gap: space.md }}>
        {!groupsConfigured || groups.length === 0 ? <T color={colors.textSecondary}>You are not sharing with any group.</T> :
          groups.map((g) => (
            <View key={g.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
              <View style={{ flex: 1 }}><T v="label">{g.name}</T><T v="caption" color={colors.textSecondary}>Free/busy only · code expires {new Date(g.expiresAt).toLocaleDateString()}</T></View>
              <Button kind="text" label="Revoke" onPress={() => revoke(g)} />
            </View>
          ))}
      </Card>
      <T v="cardTitle">Calendar</T>
      <Card><Row icon="download-outline" title="Export .ics file" sub="Works with Google, Outlook, and Apple Calendar" onPress={doExport} /></Card>
      <T v="cardTitle">Your data</T>
      <Card style={{ gap: space.md }}>
        <Row icon="document-text-outline" title="Download my data" sub="Schedules and events as a file" onPress={download} />
        <Row icon="trash-outline" title="Delete account" sub="Removes all schedules and groups" onPress={remove} />
      </Card>
    </Screen>
  );
}
