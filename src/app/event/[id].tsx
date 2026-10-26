// Add or edit one event. "new" as the id means a new event.
import { router, useLocalSearchParams } from 'expo-router';
import { goBack } from '../../lib/nav';
import { useState } from 'react';
import { View } from 'react-native';
import { confirm } from '../../lib/confirm';
import { Badge, Banner, Button, Chip, Field, Screen, T } from '../../components/ui';
import { deleteEvent, getEvent, getRules, newId, saveEvent, useEvents } from '../../data/db';
import { getSetting, setSetting } from '../../data/db';
import { Pressable } from 'react-native';
import { DEFAULT_STYLE, type TimetableStyle } from '../../lib/timetable';
import { findIssues } from '../../lib/conflicts';
import { DAY_NAMES, DAY_SHORT, formatTime, parseTime } from '../../lib/time';
import type { Weekday } from '../../lib/types';
import { colors, space } from '../../theme/tokens';

const SWATCHES = ['#E63946', '#F4A261', '#E9C46A', '#2A9D8F', '#43AA8B', '#4D96FF', '#5E60CE', '#B5179E', '#FF85A1', '#8D6E63'];

export default function EventForm() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const old = isNew ? undefined : getEvent(id);
  const all = useEvents();
  const [title, setTitle] = useState(old?.title ?? '');
  const [weekday, setWeekday] = useState<Weekday | undefined>(old?.weekday);
  // New events can repeat on a run of days: tap a start day, then an end day.
  const [rangeEnd, setRangeEnd] = useState<Weekday | undefined>();
  const ORDER: Weekday[] = [1, 2, 3, 4, 5, 6, 0];
  const days: Weekday[] = weekday === undefined ? [] : rangeEnd === undefined ? [weekday] : ORDER.slice(ORDER.indexOf(weekday), ORDER.indexOf(rangeEnd) + 1);
  function pickDay(w: Weekday) {
    if (!isNew || weekday === undefined || rangeEnd !== undefined || ORDER.indexOf(w) <= ORDER.indexOf(weekday)) { setWeekday(w); setRangeEnd(undefined); }
    else setRangeEnd(w);
  }
  const [start, setStart] = useState(old ? formatTime(old.startMin) : '');
  const [end, setEnd] = useState(old ? formatTime(old.endMin) : '');
  const [location, setLocation] = useState(old?.location ?? '');
  const [organizer, setOrganizer] = useState(old?.organizer ?? '');
  const [courseCode, setCourseCode] = useState(old?.courseCode ?? '');
  const [notes, setNotes] = useState(old?.notes ?? '');
  const style = (): TimetableStyle => ({ ...DEFAULT_STYLE, ...getSetting<Partial<TimetableStyle>>('timetableStyle', {}) });
  const [color, setColor] = useState<string | undefined>(old ? style().subjectColors[old.title.trim().toLowerCase()] : undefined);
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

  const candidate = valid ? { id: eventId, title: title.trim(), weekday: weekday!, startMin: s!, endMin: e!, location: location.trim() || undefined, organizer: organizer.trim() || undefined, sourceFileId: old?.sourceFileId, courseCode: courseCode.trim() || undefined, notes: notes.trim() || undefined } : undefined;
  const live = candidate ? findIssues([...all.filter((x) => x.id !== eventId), candidate], getRules()).filter((i) => i.eventIds.includes(eventId)) : [];

  function save() {
    setTried(true);
    if (!candidate) return;
    const st = style(), key = title.trim().toLowerCase();
    if (color || st.subjectColors[key]) {
      const subjectColors = { ...st.subjectColors };
      if (color) subjectColors[key] = color; else delete subjectColors[key];
      setSetting('timetableStyle', { ...st, subjectColors });
    }
    if (old) saveEvent({ ...candidate, id: old.id });
    else for (const d of days) saveEvent({ ...candidate, weekday: d, id: newId() });
    goBack('/calendar');
  }
  function remove() {
    confirm('Delete this event?', 'This cannot be undone.', [
      { text: 'Delete', destructive: true, onPress: () => { deleteEvent(old!.id); goBack('/calendar'); } },
    ]);
  }
  const err = (k: string) => (tried ? errors[k] : undefined);

  return (
    <Screen title={isNew ? 'New event' : 'Edit event'} back footer={<Button label="Save" onPress={save} />}>
      {!isNew && !old && <Banner tone="error" title="Event not found" message="It may have been deleted." />}
      <Field label="Title" value={title} onChangeText={setTitle} error={err('title')} placeholder="e.g. Data Structures" />
      <View style={{ gap: 6 }}>
        <T v="label">Subject color</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Chip label="Auto" on={!color} onPress={() => setColor(undefined)} />
          {SWATCHES.map((c) => (
            <Pressable key={c} onPress={() => setColor(c)} accessibilityRole="button" accessibilityLabel={`Color ${c}`} accessibilityState={{ selected: color === c }}
              style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c, borderWidth: color === c ? 3 : 1, borderColor: color === c ? colors.text : colors.border }} />
          ))}
        </View>
        <T v="caption" color={colors.textSecondary}>Used for this subject in Week, Month and the Timetable.</T>
      </View>
      <Field label="Course code (optional)" value={courseCode} onChangeText={setCourseCode} placeholder="e.g. IT 311" />
      <View style={{ gap: 6 }}>
        <T v="label">{isNew ? 'Days' : 'Day'}</T>
        {isNew && <T v="caption" color={colors.textSecondary}>Tap one day, or tap a start day then an end day (e.g. Mon, then Fri).</T>}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {ORDER.map((w) => <Chip key={w} label={DAY_SHORT[w]} on={days.includes(w)} onPress={() => pickDay(w)} />)}
        </View>
        {isNew && days.length > 1 && <T v="caption" color={colors.textSecondary}>Repeats {DAY_NAMES[days[0]]} to {DAY_NAMES[days[days.length - 1]]} ({days.length} days)</T>}
        {err('weekday') && <Badge tone="error" label={errors.weekday} />}
      </View>
      <View style={{ flexDirection: 'row', gap: space.md }}>
        <View style={{ flex: 1 }}><Field label="Start" value={start} onChangeText={setStart} error={err('start')} placeholder="9:00 AM" /></View>
        <View style={{ flex: 1 }}><Field label="End" value={end} onChangeText={setEnd} error={err('end')} placeholder="10:30 AM" /></View>
      </View>
      <Field label="Room (optional)" value={location} onChangeText={setLocation} />
      <Field label="Instructor (optional)" value={organizer} onChangeText={setOrganizer} />
      <Field label="Notes (optional)" value={notes} onChangeText={setNotes} multiline placeholder="e.g. Bring laptop" />
      {live.map((i, n) => <Banner key={n} tone={i.kind === 'overlap' ? 'error' : 'warning'} title={i.kind === 'overlap' ? 'Overlaps another event' : i.kind === 'travel' ? 'Short travel time' : 'Long stretch without a break'} message={i.message} />)}
      {old && <Button kind="text" label="Delete event" icon="trash" onPress={remove} />}
    </Screen>
  );
}
