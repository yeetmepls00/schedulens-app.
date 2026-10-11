// Vault: imported schedules, deleting them, and exporting to any calendar app (.ics).
import { useState } from 'react';
import { View } from 'react-native';
import { confirm } from '../../lib/confirm';
import { Badge, Banner, Button, Card, Empty, Screen, T } from '../../components/ui';
import { deleteFile, useEvents, useFiles } from '../../data/db';
import { exportIcs, MissingTermDatesError } from '../../lib/exportIcs';
import { colors, space } from '../../theme/tokens';

export default function Vault() {
  const files = useFiles();
  const events = useEvents();
  const [error, setError] = useState<string | null>(null);

  async function doExport() {
    setError(null);
    try { await exportIcs(events); }
    catch (e) { setError(e instanceof MissingTermDatesError ? e.message : 'Export failed. Please try again.'); }
  }

  function remove(id: string, name: string) {
    confirm(`Delete “${name}”?`, 'Choose whether to keep the events it created.', [
      { text: 'Keep events', onPress: () => deleteFile(id, false) },
      { text: 'Delete events too', destructive: true, onPress: () => deleteFile(id, true) },
    ]);
  }

  return (
    <Screen title="Vault">
      {error && <Banner tone="warning" title="Cannot export yet" message={error} />}
      <Button kind="tonal" icon="download" label="Export to calendar app (.ics)" disabled={events.length === 0} onPress={doExport} />
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
