// Vault: imported schedules, deleting them, and exporting to any calendar app (.ics).
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { confirm } from '../../lib/confirm';
import { Badge, Banner, Button, Card, Empty, Icon, Screen, T } from '../../components/ui';
import { deleteFile, useEvents, useFiles } from '../../data/db';
import { exportIcs, MissingTermDatesError } from '../../lib/exportIcs';
import { colors, space } from '../../theme/tokens';

export default function Vault() {
  const files = useFiles();
  const events = useEvents();
  const [error, setError] = useState<string | null>(null);
  // Select mode: pick several saved schedules, then export or delete them together.
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const toggle = (id: string) => setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const stopSelecting = () => { setSelecting(false); setPicked(new Set()); };
  const pickedEvents = events.filter((e) => e.sourceFileId && picked.has(e.sourceFileId));

  function removePicked() {
    const n = picked.size;
    confirm(`Delete ${n} ${n === 1 ? 'schedule' : 'schedules'}?`, 'Choose whether to keep the events they created.', [
      { text: 'Keep events', onPress: () => { picked.forEach((id) => deleteFile(id, false)); stopSelecting(); } },
      { text: 'Delete events too', destructive: true, onPress: () => { picked.forEach((id) => deleteFile(id, true)); stopSelecting(); } },
    ]);
  }

  async function doExport(list = events) {
    setError(null);
    try { await exportIcs(list); }
    catch (e) { setError(e instanceof MissingTermDatesError ? e.message : 'Export failed. Please try again.'); }
  }

  function remove(id: string, name: string) {
    confirm(`Delete “${name}”?`, 'Choose whether to keep the events it created.', [
      { text: 'Keep events', onPress: () => deleteFile(id, false) },
      { text: 'Delete events too', destructive: true, onPress: () => deleteFile(id, true) },
    ]);
  }

  return (
    <Screen title="Vault" right={files.length > 0 ? <Button kind="text" label={selecting ? 'Cancel' : 'Select'} onPress={() => (selecting ? stopSelecting() : setSelecting(true))} /> : undefined}
      footer={selecting ? (
        <View style={{ gap: space.sm }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <T v="captionStrong">{picked.size} selected</T>
            <Button kind="text" label={picked.size === files.length ? 'Select none' : 'Select all'} onPress={() => setPicked(picked.size === files.length ? new Set() : new Set(files.map((f) => f.id)))} />
          </View>
          <View style={{ flexDirection: 'row', gap: space.md }}>
            <Button kind="secondary" icon="trash" label="Delete" style={{ flex: 1 }} disabled={picked.size === 0} onPress={removePicked} />
            <Button icon="download" label="Export" style={{ flex: 1 }} disabled={pickedEvents.length === 0} onPress={() => doExport(pickedEvents)} />
          </View>
        </View>
      ) : undefined}>
      {error && <Banner tone="warning" title="Cannot export yet" message={error} />}
      {!selecting && <Button kind="tonal" icon="download" label="Export everything (.ics)" disabled={events.length === 0} onPress={() => doExport()} />}
      {selecting && <T v="caption" color={colors.textSecondary}>Tap schedules to select them, then export or delete them together.</T>}
      {files.length === 0 ? <Empty icon="folder-open-outline" title="No saved schedules" message="Schedules you import are kept here, on this device only." /> :
        files.map((f) => (
          <Pressable key={f.id} disabled={!selecting} onPress={() => toggle(f.id)} accessibilityRole={selecting ? 'checkbox' : undefined} accessibilityState={selecting ? { checked: picked.has(f.id) } : undefined}>
          <Card style={{ gap: space.sm, ...(selecting && picked.has(f.id) ? { borderColor: colors.strawberryStrong, borderWidth: 2 } : {}) }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm }}>
              {selecting && <Icon name={picked.has(f.id) ? 'checkbox' : 'square-outline'} color={picked.has(f.id) ? colors.strawberryStrong : colors.textSecondary} />}
              <T v="cardTitle" lines={1} style={{ flex: 1 }}>{f.name}</T>
              <Badge tone="neutral" label={`${f.eventCount} events`} />
            </View>
            <T v="caption" color={colors.textSecondary}>Imported {new Date(f.createdAt).toLocaleDateString()}</T>
            {!selecting && (
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: space.sm }}>
                <Button kind="text" icon="download" label="Export" disabled={!events.some((e) => e.sourceFileId === f.id)} onPress={() => doExport(events.filter((e) => e.sourceFileId === f.id))} />
                <Button kind="text" icon="trash" label="Delete" onPress={() => remove(f.id, f.name)} />
              </View>
            )}
          </Card>
          </Pressable>
        ))}
    </Screen>
  );
}
