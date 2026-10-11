// Timetable editor: pick a design preset, customize colors and layout, and
// edit classes. Nothing is saved until "Save"; Undo and Redo work on every
// change made here. The design is stored apart from the schedule, so changing
// it never changes class times or details.
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Timetable } from '../components/Timetable';
import { Badge, Banner, Button, Card, Checkbox, Chip, Field, Icon, Screen, Segmented, T } from '../components/ui';
import { getSetting, newId, saveEditorChanges, setSetting, useEvents } from '../data/db';
import { confirm } from '../lib/confirm';
import { findIssues } from '../lib/conflicts';
import { DAY_SHORT, formatTime, parseTime } from '../lib/time';
import {
  applyPreset, colorFor, commit, DEFAULT_STYLE, diffEvents, fitHours, nudge, PRESETS, presetById, redo, startHistory, undo,
  type EditorState, type PresetId, type TimetableStyle,
} from '../lib/timetable';
import type { ScheduleEvent, Weekday } from '../lib/types';
import { colors, radius, space } from '../theme/tokens';

type Tab = 'design' | 'classes';
const BACKGROUNDS = ['#FFFFFF', '#FFF8F5', '#EEF3E2', '#FDFBF4', '#EAF2FB', '#1C1719', '#20262E'];
const SWATCHES = ['#E8506A', '#F7B8C2', '#D0344F', '#6E8F4E', '#DCE8C9', '#2F7D4F', '#2B65B5', '#CDE3F5', '#C26A00', '#FBE3B8', '#7A3FB0', '#E3D4F2', '#00838F', '#3A3A3A'];
const WEEK: Weekday[] = [1, 2, 3, 4, 5, 6, 0];

const loadStyle = (): TimetableStyle => ({ ...DEFAULT_STYLE, ...getSetting<Partial<TimetableStyle>>('timetableStyle', {}) });

export default function TimetableEditor() {
  const saved = useEvents();
  const savedStyle = useMemo(loadStyle, []);
  const [h, setH] = useState(() => startHistory({ events: saved, style: savedStyle }));
  const [tab, setTab] = useState<Tab>('design');
  const [previewId, setPreviewId] = useState<PresetId | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const { events, style } = h.present;
  const shownStyle = previewId ? applyPreset(style, previewId) : style;
  const change = (next: Partial<EditorState>) => { setH((x) => commit(x, { ...x.present, ...next })); setNotice(null); };
  const setStyle = (s: Partial<TimetableStyle>) => change({ style: { ...style, ...s } });
  const setEvent = (e: ScheduleEvent) => change({ events: events.map((x) => (x.id === e.id ? e : x)) });

  const { changed, deletedIds } = diffEvents(saved, events);
  const styleChanged = JSON.stringify(style) !== JSON.stringify(savedStyle);
  const dirty = changed.length > 0 || deletedIds.length > 0 || styleChanged;
  const overlaps = findIssues(events).filter((i) => i.kind === 'overlap');
  const selected = events.find((e) => e.id === selectedId);

  function save() {
    saveEditorChanges(changed, deletedIds);
    setSetting('timetableStyle', style);
    setH(startHistory({ events, style }));
    setNotice('Saved. Your timetable will open like this next time.');
  }
  function leave() {
    if (!dirty) return router.back();
    confirm('Leave without saving?', 'Your unsaved changes to the timetable will be lost.', [
      { text: 'Discard changes', destructive: true, onPress: () => router.back() },
    ]);
  }

  const headerRight = (
    <View style={{ flexDirection: 'row' }}>
      <IconBtn icon="arrow-undo" label="Undo" disabled={!h.past.length} onPress={() => setH(undo)} />
      <IconBtn icon="arrow-redo" label="Redo" disabled={!h.future.length} onPress={() => setH(redo)} />
    </View>
  );

  return (
    <Screen title="Timetable" right={headerRight}
      footer={
        <View style={{ flexDirection: 'row', gap: space.md }}>
          <Button kind="secondary" label={dirty ? 'Cancel' : 'Close'} onPress={leave} style={{ flex: 1 }} />
          <Button label={dirty ? 'Save changes' : 'Saved'} onPress={save} disabled={!dirty} style={{ flex: 1 }} />
        </View>
      }>
      {notice && <Banner tone="success" title="Timetable saved" message={notice} />}
      {dirty && !notice && <Badge tone="warning" label="Preview: changes are not saved yet" />}
      {overlaps.length > 0 && (
        <Banner tone="warning" title={`${overlaps.length} ${overlaps.length === 1 ? 'overlap' : 'overlaps'}`}
          message={`Overlapping classes are shown side by side with a dashed red border. ${overlaps[0].message}`} />
      )}

      {events.length === 0 ? (
        <Card style={{ gap: space.sm }}>
          <T v="cardTitle">No classes yet</T>
          <T color={colors.textSecondary}>Scan a schedule or add a class to see your timetable.</T>
          <Button label="Add a class" icon="add" onPress={() => { const e = newClass(); change({ events: [...events, e] }); setSelectedId(e.id); setTab('classes'); }} />
        </Card>
      ) : (
        <Timetable events={events} style={shownStyle} selectedId={selectedId ?? undefined} title="My Class Schedule"
          onSelect={(e) => { setSelectedId(e.id); setTab('classes'); setPreviewId(null); }} />
      )}

      <Segmented value={tab} onChange={(t) => { setTab(t); setPreviewId(null); }} options={[{ key: 'design', label: 'Design' }, { key: 'classes', label: 'Classes' }]} />

      {tab === 'design' ? (
        <>
          <T v="section">Presets</T>
          <T v="caption" color={colors.textSecondary}>Tap a preset to preview it above. Applying a preset only changes the look. Your classes stay the same.</T>
          {PRESETS.map((p) => {
            const active = style.preset === p.id && !previewId, previewing = previewId === p.id;
            return (
              <Pressable key={p.id} onPress={() => setPreviewId(previewing ? null : p.id)} accessibilityRole="button" accessibilityLabel={`Preview ${p.name}`}>
                <Card style={{ gap: space.sm, borderWidth: 2, borderColor: previewing ? colors.strawberry : active ? colors.matcha : 'transparent' }}>
                  <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
                    <View style={{ width: 96 }}>
                      <Timetable compact events={events.length ? events : SAMPLE} style={applyPreset(style, p.id)} />
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <T v="cardTitle">{p.name}</T>
                      <T v="caption" color={colors.textSecondary}>{p.description}</T>
                      {active && <Badge tone="success" label="Current design" />}
                    </View>
                  </View>
                  {previewing && (
                    <View style={{ flexDirection: 'row', gap: space.sm }}>
                      <Button kind="secondary" label="Cancel preview" onPress={() => setPreviewId(null)} style={{ flex: 1 }} />
                      <Button label={`Apply ${p.name}`} onPress={() => { change({ style: applyPreset(style, p.id) }); setPreviewId(null); }} style={{ flex: 1 }} />
                    </View>
                  )}
                </Card>
              </Pressable>
            );
          })}

          <T v="section">Customize</T>
          <Card style={{ gap: space.md }}>
            <T v="label">Background</T>
            <Swatches colors={BACKGROUNDS} value={style.background} onPick={(c) => setStyle({ background: c, ...(isDark(c) ? { text: '#F5ECEE', mutedText: '#BFAFB2', gridLine: '#3A3134' } : { text: '#2A2224', mutedText: '#6B5B5D', gridLine: '#E9DADC' }) })} />
            <T v="label">Text size</T>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {[['Small', 0.85], ['Normal', 1], ['Large', 1.2]].map(([l, v]) => <Chip key={l} label={l as string} on={style.fontScale === v} onPress={() => setStyle({ fontScale: v as number })} />)}
              <Chip label="Bold titles" on={style.bold} onPress={() => setStyle({ bold: !style.bold })} />
            </View>
            <T v="label">Show on each class</T>
            <View style={{ gap: 4 }}>
              <Checkbox label="Course code" on={style.showCode} onPress={() => setStyle({ showCode: !style.showCode })} />
              <Checkbox label="Room" on={style.showRoom} onPress={() => setStyle({ showRoom: !style.showRoom })} />
              <Checkbox label="Instructor" on={style.showInstructor} onPress={() => setStyle({ showInstructor: !style.showInstructor })} />
              <Checkbox label="Notes (Planner Style)" on={style.showNotes} onPress={() => setStyle({ showNotes: !style.showNotes })} />
            </View>
            <T v="label">Days shown</T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {WEEK.map((d) => <Chip key={d} label={DAY_SHORT[d]} on={style.days.includes(d)}
                onPress={() => setStyle({ days: style.days.includes(d) ? (style.days.length > 1 ? style.days.filter((x) => x !== d) : style.days) : WEEK.filter((x) => style.days.includes(x) || x === d) })} />)}
            </View>
            <T v="label">Hours shown: {formatTime(style.startHour * 60)} to {formatTime(style.endHour * 60)}</T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              <Chip label="Start earlier" on={false} onPress={() => setStyle({ startHour: Math.max(0, style.startHour - 1) })} />
              <Chip label="Start later" on={false} onPress={() => setStyle({ startHour: Math.min(style.endHour - 1, style.startHour + 1) })} />
              <Chip label="End earlier" on={false} onPress={() => setStyle({ endHour: Math.max(style.startHour + 1, style.endHour - 1) })} />
              <Chip label="End later" on={false} onPress={() => setStyle({ endHour: Math.min(24, style.endHour + 1) })} />
              <Chip label="Fit to my classes" on={false} onPress={() => setStyle(fitHours(events, style))} />
            </View>
            <T v="label">Row height</T>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {[['Compact', 36], ['Comfortable', 48], ['Spacious', 64]].map(([l, v]) => <Chip key={l} label={l as string} on={style.hourHeight === v} onPress={() => setStyle({ hourHeight: v as number })} />)}
            </View>
            <Button kind="tonal" label={`Reset look to ${presetById(style.preset).name}`} icon="refresh" onPress={() => change({ style: applyPreset(style, style.preset) })} />
            <T v="caption" color={colors.textSecondary}>Resetting only changes colors and layout. Your classes are not touched.</T>
          </Card>
        </>
      ) : (
        <>
          <Button kind="tonal" icon="add" label="Add a class" onPress={() => { const e = newClass(); change({ events: [...events, e] }); setSelectedId(e.id); }} />
          {!selected ? (
            <>
              <T color={colors.textSecondary}>Tap a class in the timetable, or pick one below, to edit it.</T>
              {events.map((e) => (
                <Pressable key={e.id} onPress={() => setSelectedId(e.id)} accessibilityRole="button">
                  <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                    <View style={{ width: 14, height: 14, borderRadius: 4, backgroundColor: colorFor(e, events, style) }} />
                    <View style={{ flex: 1 }}>
                      <T v="label">{e.title}</T>
                      <T v="caption" color={colors.textSecondary}>{DAY_SHORT[e.weekday]} {formatTime(e.startMin)}–{formatTime(e.endMin)}{e.location ? ` · ${e.location}` : ''}</T>
                    </View>
                    <Icon name="chevron-forward" size={18} color={colors.textSecondary} />
                  </Card>
                </Pressable>
              ))}
            </>
          ) : (
            <ClassPanel key={selected.id} event={selected} color={colorFor(selected, events, style)}
              onChange={setEvent}
              onColor={(c) => setStyle({ subjectColors: { ...style.subjectColors, [selected.title.trim().toLowerCase()]: c } })}
              onDuplicate={() => { const copy = { ...selected, id: newId(), sourceFileId: undefined }; change({ events: [...events, copy] }); setSelectedId(copy.id); }}
              onDelete={() => { change({ events: events.filter((x) => x.id !== selected.id) }); setSelectedId(null); }}
              onClose={() => setSelectedId(null)} />
          )}
        </>
      )}
    </Screen>
  );
}

function ClassPanel({ event: e, color, onChange, onColor, onDuplicate, onDelete, onClose }: {
  event: ScheduleEvent; color: string; onChange: (e: ScheduleEvent) => void; onColor: (c: string) => void;
  onDuplicate: () => void; onDelete: () => void; onClose: () => void;
}) {
  // Text fields are edited locally and applied when valid, so typing doesn't fill the undo history.
  const [f, setF] = useState({ title: e.title, courseCode: e.courseCode ?? '', location: e.location ?? '', organizer: e.organizer ?? '', notes: e.notes ?? '', start: formatTime(e.startMin), end: formatTime(e.endMin) });
  const s = parseTime(f.start)?.minutes, en = parseTime(f.end)?.minutes;
  const err = !f.title.trim() ? 'Add a title' : s === undefined ? 'Start time: use a time like 9:00 AM' : en === undefined ? 'End time: use a time like 10:30 AM' : en <= s ? 'End must be after start' : null;
  const apply = () => { if (!err) onChange({ ...e, title: f.title.trim(), courseCode: f.courseCode.trim() || undefined, location: f.location.trim() || undefined, organizer: f.organizer.trim() || undefined, notes: f.notes.trim() || undefined, startMin: s!, endMin: en! }); };
  const move = (c: Parameters<typeof nudge>[1]) => { const n = nudge(e, c); onChange(n); setF((x) => ({ ...x, start: formatTime(n.startMin), end: formatTime(n.endMin) })); };
  const pending = !err && (f.title.trim() !== e.title || (f.courseCode.trim() || undefined) !== e.courseCode || (f.location.trim() || undefined) !== e.location || (f.organizer.trim() || undefined) !== e.organizer || (f.notes.trim() || undefined) !== e.notes || s !== e.startMin || en !== e.endMin);

  return (
    <Card style={{ gap: space.md }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <T v="cardTitle">Edit class</T>
        <Button kind="text" label="Done" onPress={() => { apply(); onClose(); }} />
      </View>
      <Field label="Subject" value={f.title} onChangeText={(v) => setF({ ...f, title: v })} onBlur={apply} />
      <Field label="Course code" value={f.courseCode} onChangeText={(v) => setF({ ...f, courseCode: v })} onBlur={apply} placeholder="e.g. IT 311" />
      <View style={{ flexDirection: 'row', gap: space.md }}>
        <View style={{ flex: 1 }}><Field label="Start" value={f.start} onChangeText={(v) => setF({ ...f, start: v })} onBlur={apply} /></View>
        <View style={{ flex: 1 }}><Field label="End" value={f.end} onChangeText={(v) => setF({ ...f, end: v })} onBlur={apply} /></View>
      </View>
      <Field label="Room" value={f.location} onChangeText={(v) => setF({ ...f, location: v })} onBlur={apply} />
      <Field label="Instructor" value={f.organizer} onChangeText={(v) => setF({ ...f, organizer: v })} onBlur={apply} />
      <Field label="Notes" value={f.notes} onChangeText={(v) => setF({ ...f, notes: v })} onBlur={apply} multiline />
      {err ? <Badge tone="error" label={err} /> : pending ? <Button kind="secondary" label="Apply changes" onPress={apply} /> : null}
      <T v="label">Day</T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {WEEK.map((d) => <Chip key={d} label={DAY_SHORT[d]} on={e.weekday === d} onPress={() => onChange({ ...e, weekday: d })} />)}
      </View>
      <T v="label">Move and resize</T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        <Chip label="◀ Day before" on={false} onPress={() => move({ dayBy: -1 })} />
        <Chip label="Day after ▶" on={false} onPress={() => move({ dayBy: 1 })} />
        <Chip label="▲ 15 min earlier" on={false} onPress={() => move({ startBy: -15 })} />
        <Chip label="▼ 15 min later" on={false} onPress={() => move({ startBy: 15 })} />
        <Chip label="Shorter" on={false} onPress={() => move({ endBy: -15 })} />
        <Chip label="Longer" on={false} onPress={() => move({ endBy: 15 })} />
      </View>
      <T v="label">Color for “{e.title}”</T>
      <Swatches colors={SWATCHES} value={color} onPick={onColor} />
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Button kind="secondary" icon="copy" label="Duplicate" onPress={onDuplicate} style={{ flex: 1 }} />
        <Button kind="secondary" icon="trash" label="Delete" onPress={onDelete} style={{ flex: 1 }} />
      </View>
      <T v="caption" color={colors.textSecondary}>Deleting here can be undone until you save.</T>
    </Card>
  );
}

function Swatches({ colors: list, value, onPick }: { colors: string[]; value: string; onPick: (c: string) => void }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {list.map((c) => (
        <Pressable key={c} onPress={() => onPick(c)} accessibilityRole="button" accessibilityLabel={`Color ${c}`} accessibilityState={{ selected: value.toLowerCase() === c.toLowerCase() }}
          style={{ width: 32, height: 32, borderRadius: radius.pill, backgroundColor: c, borderWidth: value.toLowerCase() === c.toLowerCase() ? 3 : 1, borderColor: value.toLowerCase() === c.toLowerCase() ? colors.text : colors.border }} />
      ))}
    </View>
  );
}

function IconBtn({ icon, label, onPress, disabled }: { icon: 'arrow-undo' | 'arrow-redo'; label: string; onPress: () => void; disabled: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }}
      style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.35 : 1 }}>
      <Icon name={icon} size={20} />
    </Pressable>
  );
}

const isDark = (hex: string) => parseInt(hex.slice(1, 3), 16) + parseInt(hex.slice(3, 5), 16) + parseInt(hex.slice(5, 7), 16) < 200;
const newClass = (): ScheduleEvent => ({ id: newId(), title: 'New class', weekday: 1, startMin: 8 * 60, endMin: 9 * 60 });

// Shown in preset previews before any classes exist. Never saved.
const SAMPLE: ScheduleEvent[] = [
  { id: 's1', title: 'Math', weekday: 1, startMin: 480, endMin: 600 }, { id: 's2', title: 'English', weekday: 2, startMin: 600, endMin: 690 },
  { id: 's3', title: 'Science', weekday: 3, startMin: 540, endMin: 660 }, { id: 's4', title: 'History', weekday: 4, startMin: 780, endMin: 870 },
  { id: 's5', title: 'Math', weekday: 5, startMin: 480, endMin: 600 },
];
