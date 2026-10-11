// Add or edit one event. "new" as the id means a new event.
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { Badge, Banner, Button, Chip, Field, Screen, T } from '../../components/ui';
import { deleteEvent, getEvent, getRules, newId, saveEvent, useEvents } from '../../data/db';
import { findIssues } from '../../lib/conflicts';
import { DAY_SHORT, formatTime, parseTime } from '../../lib/time';
import type { Weekday } from '../../lib/types';
import { space } from '../../theme/tokens';

export default function EventForm() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const old = isNew ? undefined : getEvent(id);
  const all = useEvents();
  const [title, setTitle] = useState(old?.title ?? '');
  const [weekday, setWeekday] = useState<Weekday | undefined>(old?.weekday);
  const [start, setStart] = useState(old ? formatTime(old.startMin) : '');
  const [end, setEnd] = useState(old ? formatTime(old.endMin) : '');
  const [location, setLocation] = useState(old?.location ?? '');
  const [organizer, setOrganizer] = useState(old?.organizer ?? '');
  const [tried, setTried] = useState(false);

  const s = parseTime(start)?.minutes, e = parseTime(end)?.minutes;
  const errors: Record<string, string> = {};
  if (!title.trim()) errors.title = 'Add a title';
  if (weekday === undefined) errors.weekday = 'Pick a day';
  if (s === undefined) errors.start = 'Use a time like 9:00 AM';
  if (e === undefined) errors.end = 'Use a time like 10:30 AM';
  if (s !== undefined && e !== undefined && e <= s) errors.end = 'End must be after start';
  const valid = Object.keys(errors).length === 0;
  const eventId = old?.id ?? 'pending';

  const candidate = valid ? { id: eventId, title: title.trim(), weekday: weekday!, startMin: s!, endMin: e!, location: location.trim() || undefined, organizer: organizer.trim() || undefined, sourceFileId: old?.sourceFileId } : undefined;
  const live = candidate ? findIssues([...all.filter((x) => x.id !== eventId), candidate], getRules()).filter((i) => i.eventIds.includes(eventId)) : [];

  function save() {
    setTried(true);
    if (!candidate) return;
    saveEvent({ ...candidate, id: old?.id ?? newId() });
    router.back();
  }
  function remove() {
    Alert.alert('Delete this event?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { deleteEvent(old!.id); router.back(); } },
    ]);
  }
  const err = (k: string) => (tried ? errors[k] : undefined);

  return (
    <Screen title={isNew ? 'New event' : 'Edit event'} back footer={<Button label="Save" onPress={save} />}>
      {!isNew && !old && <Banner tone="error" title="Event not found" message="It may have been deleted." />}
      <Field label="Title" value={title} onChangeText={setTitle} error={err('title')} placeholder="e.g. Data Structures" />
      <View style={{ gap: 6 }}>
        <T v="label">Day</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {DAY_SHORT.map((d, w) => <Chip key={d} label={d} on={weekday === w} onPress={() => setWeekday(w as Weekday)} />)}
        </View>
        {err('weekday') && <Badge tone="error" label={errors.weekday} />}
      </View>
      <View style={{ flexDirection: 'row', gap: space.md }}>
        <View style={{ flex: 1 }}><Field label="Start" value={start} onChangeText={setStart} error={err('start')} placeholder="9:00 AM" /></View>
        <View style={{ flex: 1 }}><Field label="End" value={end} onChangeText={setEnd} error={err('end')} placeholder="10:30 AM" /></View>
      </View>
      <Field label="Room (optional)" value={location} onChangeText={setLocation} />
      <Field label="Instructor (optional)" value={organizer} onChangeText={setOrganizer} />
      {live.map((i, n) => <Banner key={n} tone={i.kind === 'overlap' ? 'error' : 'warning'} title={i.kind === 'overlap' ? 'Overlaps another event' : i.kind === 'travel' ? 'Short travel time' : 'Long stretch without a break'} message={i.message} />)}
      {old && <Button kind="text" label="Delete event" icon="trash" onPress={remove} />}
    </Screen>
  );
}
