// Vault: imported schedules, deleting them, and exporting to any calendar app (.ics).
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { Badge, Banner, Button, Card, Empty, Screen, T } from '../../components/ui';
import { deleteFile, getSetting, useEvents, useFiles } from '../../data/db';
import { buildIcs } from '../../lib/ics';
import { colors, space } from '../../theme/tokens';

export default function Vault() {
  const files = useFiles();
  const events = useEvents();
  const [error, setError] = useState<string | null>(null);

  async function exportIcs() {
    setError(null);
    const start = getSetting<string | null>('termStart', null), end = getSetting<string | null>('termEnd', null);
    if (!start || !end) { setError('Set your term start and end dates in Settings first, so repeating events stop at the end of the term.'); return; }
    try {
      const file = new File(Paths.cache, 'schedulens.ics');
      if (file.exists) file.delete();
      file.create();
      file.write(buildIcs(events, new Date(start), new Date(end)));
      await Sharing.shareAsync(file.uri, { mimeType: 'text/calendar', UTI: 'public.calendar-event' });
    } catch { setError('Export failed. Please try again.'); }
  }

  function remove(id: string, name: string) {
    Alert.alert(`Delete “${name}”?`, 'Choose whether to keep the events it created.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Keep events', onPress: () => deleteFile(id, false) },
      { text: 'Delete events too', style: 'destructive', onPress: () => deleteFile(id, true) },
    ]);
  }

  return (
    <Screen title="Vault">
      {error && <Banner tone="warning" title="Cannot export yet" message={error} />}
      <Button kind="tonal" icon="download" label="Export to calendar app (.ics)" disabled={events.length === 0} onPress={exportIcs} />
      {files.length === 0 ? <Empty icon="folder-open-outline" title="No saved schedules" message="Schedules you import are kept here, on this phone only." /> :
        files.map((f) => (
          <Card key={f.id} style={{ gap: space.sm }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <T v="cardTitle" lines={1} style={{ flex: 1 }}>{f.name}</T>
              <Badge tone="neutral" label={`${f.eventCount} events`} />
            </View>
            <T v="caption" color={colors.textSecondary}>Imported {new Date(f.createdAt).toLocaleDateString()}</T>
            <Button kind="text" icon="trash" label="Delete" onPress={() => remove(f.id, f.name)} />
          </Card>
        ))}
    </Screen>
  );
}
