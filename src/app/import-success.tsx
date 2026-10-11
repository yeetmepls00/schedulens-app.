// 3.6 Import Success. Shown after you confirm a scanned schedule.
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Banner, Button, Card, Icon, Screen, T } from '../components/ui';
import { useEvents } from '../data/db';
import { exportIcs, MissingTermDatesError } from '../lib/exportIcs';
import { colors, space } from '../theme/tokens';

export default function ImportSuccess() {
  const { name, added, issues } = useLocalSearchParams<{ name: string; added: string; issues: string }>();
  const events = useEvents();
  const [error, setError] = useState<string | null>(null);
  const nAdded = Number(added ?? 0), nIssues = Number(issues ?? 0);
  async function doExport() {
    setError(null);
    try { await exportIcs(events); }
    catch (e) { setError(e instanceof MissingTermDatesError ? e.message : 'Export failed. Please try again.'); }
  }
  return (
    <Screen title="" footer={<Button label="View Calendar" onPress={() => router.replace('/calendar')} />}>
      <View style={{ alignItems: 'center', gap: space.md, paddingTop: space.xl }}>
        <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: colors.successSurface, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="checkmark" size={56} color={colors.success} />
        </View>
        <T v="welcome" center>Schedule imported</T>
        <T center color={colors.textSecondary}>
          {nAdded} {nAdded === 1 ? 'event was' : 'events were'} added to your calendar.
          {nIssues > 0 ? ` ${nIssues} ${nIssues === 1 ? 'warning was' : 'warnings were'} kept so you can fix ${nIssues === 1 ? 'it' : 'them'} later.` : ''}
        </T>
      </View>
      <View style={{ flexDirection: 'row', gap: space.md }}>
        <Card style={{ flex: 1, alignItems: 'center' }}><T v="caption" color={colors.textSecondary}>Events added</T><T v="welcome">{nAdded}</T></Card>
        <Card style={{ flex: 1, alignItems: 'center' }}><T v="caption" color={colors.textSecondary}>Warnings kept</T><T v="welcome">{nIssues}</T></Card>
      </View>
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <Icon name="folder-outline" color={colors.matchaStrong} />
        <View style={{ flex: 1 }}><T v="caption" color={colors.textSecondary}>Saved to Vault</T><T v="label">{name}</T></View>
      </Card>
      {error && <Banner tone="warning" title="Cannot export yet" message={error} />}
      {nIssues > 0 && <Button kind="secondary" label="Review warnings" icon="alert-circle-outline" onPress={() => router.push('/review')} />}
      <Button kind="tonal" label="Export .ics" icon="download" onPress={doExport} />
    </Screen>
  );
}
