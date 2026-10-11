// Verify: the user checks every extracted value before saving.
// Values the parser was unsure about are highlighted; nothing saves until Confirm.
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Image, View } from 'react-native';
import { Badge, Banner, Button, Card, Chip, Field, Screen, T } from '../components/ui';
import { newId, saveImport, getRules, useEvents } from '../data/db';
import { getDraft, setDraft } from '../data/draft';
import { findIssues } from '../lib/conflicts';
import { DAY_SHORT, formatTime, parseTime } from '../lib/time';
import type { ExtractedEvent, ScheduleEvent, Weekday } from '../lib/types';
import { colors, space } from '../theme/tokens';

interface Row { title: string; weekday?: Weekday; start: string; end: string; location: string; organizer: string; src: ExtractedEvent; keep: boolean }

const toRow = (e: ExtractedEvent): Row => ({
  title: e.title.value ?? '', weekday: e.weekday.value,
  start: e.startMin.value !== undefined ? formatTime(e.startMin.value) : '',
  end: e.endMin.value !== undefined ? formatTime(e.endMin.value) : '',
  location: e.location.value ?? '', organizer: e.organizer.value ?? '', src: e, keep: true,
});

function check(r: Row) {
  const s = parseTime(r.start)?.minutes, e = parseTime(r.end)?.minutes;
  const errors: Record<string, string> = {};
  if (!r.title.trim()) errors.title = 'Add a title';
  if (r.weekday === undefined) errors.weekday = 'Pick a day';
  if (s === undefined) errors.start = 'Use a time like 9:00 AM';
  if (e === undefined) errors.end = 'Use a time like 10:30 AM';
  if (s !== undefined && e !== undefined && e <= s) errors.end = 'End must be after start';
  return { errors, s, e };
}

export default function Verify() {
  const draft = getDraft();
  const existing = useEvents();
  const [rows, setRows] = useState<Row[]>(() => (draft?.events ?? []).map(toRow));
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const set = (i: number, k: keyof Row, v: unknown) => {
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
    setTouched((t) => new Set(t).add(`${i}.${k}`));
  };

  const checked = rows.map(check);
  const kept = rows.filter((r) => r.keep);
  const invalid = rows.filter((r, i) => r.keep && Object.keys(checked[i].errors).length > 0).length;

  const newEvents: ScheduleEvent[] = useMemo(() => rows.flatMap((r, i) => {
    const c = checked[i];
    if (!r.keep || Object.keys(c.errors).length) return [];
    return [{ id: `draft-${i}`, title: r.title.trim(), weekday: r.weekday!, startMin: c.s!, endMin: c.e!, location: r.location.trim() || undefined, organizer: r.organizer.trim() || undefined }];
  }), [rows]); // eslint-disable-line react-hooks/exhaustive-deps
  const issueCount = findIssues([...existing, ...newEvents], getRules()).filter((x) => x.eventIds.some((id) => id.startsWith('draft-'))).length;

  if (!draft) return <Screen title="Verify" back><T>Nothing to verify. Scan a schedule first.</T></Screen>;

  function confirm() {
    const fileId = newId();
    saveImport({ id: fileId, name: draft!.fileName, uri: draft!.uri, kind: draft!.kind },
      newEvents.map((e) => ({ ...e, id: newId(), sourceFileId: fileId })));
    setDraft(null);
    router.dismissAll();
    router.replace(issueCount ? '/review' : '/calendar');
  }

  const tone = (i: number, k: keyof Row, conf: string) =>
    touched.has(`${i}.${k}`) ? 'edited' as const : conf === 'missing' ? 'missing' as const : conf === 'low' ? 'low' as const : undefined;

  return (
    <Screen title="Check your schedule" back
      footer={<Button label={`Save ${newEvents.length} ${newEvents.length === 1 ? 'event' : 'events'}`} onPress={confirm} disabled={invalid > 0 || newEvents.length === 0} />}>
      {draft.uri && <Image source={{ uri: draft.uri }} style={{ width: '100%', height: 180, borderRadius: 12 }} resizeMode="contain" accessibilityLabel="Your schedule image" />}
      <Banner tone={invalid ? 'warning' : 'success'} title={invalid ? `${invalid} ${invalid === 1 ? 'event needs' : 'events need'} fixing` : 'Ready to save'}
        message="Compare each event with your image. Highlighted values were hard to read." />
      {issueCount > 0 && <Banner tone="warning" title={`${issueCount} schedule ${issueCount === 1 ? 'warning' : 'warnings'}`} message="You can still save. You will see the details on the next screen." />}
      {rows.map((r, i) => {
        const { errors } = checked[i];
        return (
          <Card key={i} style={{ gap: space.md, opacity: r.keep ? 1 : 0.55 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <T v="captionStrong" color={colors.textSecondary}>Event {i + 1}</T>
              <Chip label={r.keep ? 'Included' : 'Skipped'} on={r.keep} onPress={() => set(i, 'keep', !r.keep)} />
            </View>
            <T v="caption" color={colors.textSecondary}>Read as: “{r.src.sourceText}”</T>
            {r.keep && <>
              <Field label="Title" value={r.title} onChangeText={(v) => set(i, 'title', v)} error={errors.title} tone={tone(i, 'title', r.src.title.confidence)} />
              <View style={{ gap: 6 }}>
                <T v="label">Day</T>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {DAY_SHORT.map((d, w) => <Chip key={d} label={d} on={r.weekday === w} onPress={() => set(i, 'weekday', w as Weekday)} />)}
                </View>
                {errors.weekday ? <Badge tone="error" label={errors.weekday} /> : r.src.weekday.confidence === 'low' && !touched.has(`${i}.weekday`) ? <Badge tone="warning" label="Please confirm the day" /> : null}
              </View>
              <View style={{ flexDirection: 'row', gap: space.md }}>
                <View style={{ flex: 1 }}><Field label="Start" value={r.start} onChangeText={(v) => set(i, 'start', v)} error={errors.start} tone={tone(i, 'start', r.src.startMin.confidence)} /></View>
                <View style={{ flex: 1 }}><Field label="End" value={r.end} onChangeText={(v) => set(i, 'end', v)} error={errors.end} tone={tone(i, 'end', r.src.endMin.confidence)} /></View>
              </View>
              <Field label="Room (optional)" value={r.location} onChangeText={(v) => set(i, 'location', v)} />
              <Field label="Instructor (optional)" value={r.organizer} onChangeText={(v) => set(i, 'organizer', v)} />
            </>}
          </Card>
        );
      })}
    </Screen>
  );
}
