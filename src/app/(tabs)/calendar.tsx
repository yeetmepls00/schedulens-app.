// Calendar: Day, Week, Month, List, and Heatmap views of the weekly schedule.
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { confirm } from '../../lib/confirm';
import { EventCard } from '../../components/EventCard';
import { Banner, Button, Chip, Empty, Icon, Screen, Segmented, T } from '../../components/ui';
import { deleteEvent, getSetting } from '../../data/db';
import { useSchedule } from '../../data/hooks';
import { nextEvent } from '../../lib/next';
import { colorFor, DEFAULT_STYLE, textOn, type TimetableStyle } from '../../lib/timetable';
import { DAY_NAMES, DAY_SHORT, formatDuration, formatTime } from '../../lib/time';
import type { ScheduleEvent, Weekday } from '../../lib/types';
import { colors, radius, space } from '../../theme/tokens';

type View_ = 'day' | 'week' | 'month' | 'list' | 'heatmap';
/** Subject colors from the Timetable editor, so every view matches. */
const subjectColor = (e: ScheduleEvent, all: ScheduleEvent[]) => colorFor(e, all, { ...DEFAULT_STYLE, ...getSetting<Partial<TimetableStyle>>('timetableStyle', {}) });
const WEEK: Weekday[] = [1, 2, 3, 4, 5, 6, 0];
const START = 7 * 60;
const END = 21 * 60;

export default function Calendar() {
  const { events, issueFor, issues } = useSchedule();
  const [view, setView] = useState<View_>(() => getSetting<View_>('defaultView', 'day'));
  const [day, setDay] = useState<Weekday>(new Date().getDay() as Weekday);
  // Select mode: tick events, then delete them together.
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const stop = () => { setSelecting(false); setPicked(new Set()); };
  const toggle = (id: string) => setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const canSelect = view === 'day' || view === 'list' || view === 'month';
  function removePicked() {
    const n = picked.size;
    confirm(`Delete ${n} ${n === 1 ? 'event' : 'events'}?`, 'This cannot be undone.', [
      { text: 'Delete', destructive: true, onPress: () => { picked.forEach((id) => deleteEvent(id)); stop(); } },
    ]);
  }
  const card = (e: ScheduleEvent) => selecting ? (
    <Pressable key={e.id} onPress={() => toggle(e.id)} accessibilityRole="checkbox" accessibilityState={{ checked: picked.has(e.id) }} accessibilityLabel={e.title}
      style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
      <Icon name={picked.has(e.id) ? 'checkbox' : 'square-outline'} color={picked.has(e.id) ? colors.strawberryStrong : colors.textSecondary} size={26} />
      <View style={{ flex: 1, opacity: picked.has(e.id) ? 1 : 0.85 }} pointerEvents="none"><EventCard event={e} issue={issueFor(e.id)} onPress={() => toggle(e.id)} /></View>
    </Pressable>
  ) : <EventCard key={e.id} event={e} issue={issueFor(e.id)} onPress={() => router.push(`/event/${e.id}`)} />;
  const add = !selecting ? <Button label="Add" kind="text" icon="add" onPress={() => router.push('/event/new')} /> : null;
  const select = events.length > 0 && canSelect
    ? <Button label={selecting ? 'Done' : 'Select'} kind="text" onPress={() => (selecting ? stop() : setSelecting(true))} /> : null;

  return (
    <Screen title="Calendar" left={select} right={add} footer={selecting ? (
      <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
        <T v="captionStrong" style={{ flex: 1 }}>{picked.size} selected</T>
        <Button kind="secondary" label="Cancel" onPress={stop} />
        <Button icon="trash" label="Delete" disabled={picked.size === 0} onPress={removePicked} />
      </View>
    ) : undefined}>
      <Segmented value={view} onChange={(v) => { setView(v); stop(); }} options={[{ key: 'day', label: 'Day' }, { key: 'week', label: 'Week' }, { key: 'month', label: 'Month' }, { key: 'list', label: 'List' }, { key: 'heatmap', label: 'Heatmap' }]} />
      {events.length === 0 ? (
        <Empty icon="calendar-outline" title="Your calendar is empty" message="Import a schedule or add an event." action="Add event" onAction={() => router.push('/event/new')} />
      ) : view === 'day' ? (
        <>
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            {WEEK.map((d) => <Chip key={d} label={DAY_SHORT[d]} on={d === day} onPress={() => setDay(d)} />)}
          </View>
          <T v="cardTitle">{DAY_NAMES[day]} · {events.filter((e) => e.weekday === day).length} events</T>
          {events.filter((e) => e.weekday === day).map(card)}
          <FreeDay events={events} day={day} label={DAY_NAMES[day]} issueFor={issueFor} />
        </>
      ) : view === 'week' ? (
        <WeekGrid events={events} conflictIds={new Set(issues.filter((i) => i.kind === 'overlap').flatMap((i) => i.eventIds))} />
      ) : view === 'month' ? (
        <MonthView card={card} events={events} conflictIds={new Set(issues.filter((i) => i.kind === 'overlap').flatMap((i) => i.eventIds))} issueFor={issueFor} />
      ) : view === 'list' ? (
        WEEK.filter((d) => events.some((e) => e.weekday === d)).map((d) => (
          <View key={d} style={{ gap: space.sm }}>
            <T v="captionStrong" color={colors.textSecondary}>{DAY_NAMES[d].toUpperCase()}</T>
            {events.filter((e) => e.weekday === d).map(card)}
          </View>
        ))
      ) : (
        <Heatmap events={events} />
      )}
      {events.length > 0 && (
        <Pressable onPress={() => router.push('/timetable')} accessibilityRole="button" accessibilityLabel="Open the timetable editor"
          style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.card, backgroundColor: '#FFF4E8', borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#F4B860', marginTop: space.sm }}>
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFE3E8', alignItems: 'center', justifyContent: 'center' }}><T style={{ fontSize: 24 }}>🖍️</T></View>
          <View style={{ flex: 1 }}>
            <T v="cardTitle">Design your timetable</T>
            <T v="caption" color={colors.textSecondary}>Pick colors and a theme for your week.</T>
          </View>
          <T v="cardTitle" color={colors.strawberryStrong}>›</T>
        </Pressable>
      )}
    </Screen>
  );
}

function WeekGrid({ events, conflictIds }: { events: ScheduleEvent[]; conflictIds: Set<string> }) {
  const hourH = 40;
  const days = WEEK.slice(0, 6);
  return (
    <View style={{ backgroundColor: colors.white, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border, padding: space.sm }}>
      <View style={{ flexDirection: 'row', marginLeft: 36 }}>
        {days.map((d) => <T key={d} v="captionStrong" color={colors.textSecondary} center style={{ flex: 1 }}>{DAY_SHORT[d]}</T>)}
      </View>
      <View style={{ flexDirection: 'row', height: ((END - START) / 60) * hourH }}>
        <View style={{ width: 36 }}>
          {Array.from({ length: (END - START) / 120 }, (_, i) => (
            <T key={i} v="caption" color={colors.textSecondary} style={{ position: 'absolute', top: i * 2 * hourH - 6, fontSize: 10 }}>
              {formatTime(START + i * 120).replace(':00', '')}
            </T>
          ))}
        </View>
        {days.map((d) => (
          <View key={d} style={{ flex: 1, borderLeftWidth: 1, borderColor: colors.border }}>
            {events.filter((e) => e.weekday === d).map((e) => {
              const bad = conflictIds.has(e.id);
              const bg = subjectColor(e, events);
              return (
                <Pressable key={e.id} onPress={() => router.push(`/event/${e.id}`)} accessibilityLabel={`${e.title} ${formatTime(e.startMin)}`}
                  style={{ position: 'absolute', left: 2, right: 2, top: ((Math.max(e.startMin, START) - START) / 60) * hourH, height: Math.max(18, ((Math.min(e.endMin, END) - Math.max(e.startMin, START)) / 60) * hourH - 2), backgroundColor: bg, borderColor: bad ? colors.error : bg, borderWidth: bad ? 2 : 1, borderRadius: 6, padding: 2, overflow: 'hidden' }}>
                  <T v="caption" color={textOn(bg)} style={{ fontSize: 10, fontWeight: '700' }} lines={3}>{e.title}</T>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

/** Clearly different steps from free (white) to fully booked (dark red). */
const heat = (m: number) => (m === 0 ? colors.card : m <= 30 ? '#FFE9A8' : m <= 60 ? '#FDB863' : m <= 90 ? '#E8603C' : '#A3172F');

/** Hours scheduled per day and time slot. Darker = busier. */
function Heatmap({ events }: { events: ScheduleEvent[] }) {
  const slots = Array.from({ length: (END - START) / 120 }, (_, i) => START + i * 120);
  const busy = (d: Weekday, from: number) =>
    events.filter((e) => e.weekday === d).reduce((sum, e) => sum + Math.max(0, Math.min(e.endMin, from + 120) - Math.max(e.startMin, from)), 0);
  const totals = WEEK.map((d) => ({ d, min: events.filter((e) => e.weekday === d).reduce((s, e) => s + e.endMin - e.startMin, 0) }));
  const top = [...totals].sort((a, b) => b.min - a.min)[0];
  return (
    <>
      <View style={{ backgroundColor: colors.white, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border, padding: space.md, gap: 6 }}>
        <View style={{ flexDirection: 'row', marginLeft: 44, gap: 4 }}>
          {WEEK.map((d) => <T key={d} v="captionStrong" color={colors.textSecondary} center style={{ flex: 1 }}>{DAY_SHORT[d][0]}</T>)}
        </View>
        {slots.map((from) => (
          <View key={from} style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
            <T v="caption" color={colors.textSecondary} style={{ width: 40, fontSize: 10 }}>{formatTime(from).replace(':00', '')}</T>
            {WEEK.map((d) => {
              const m = busy(d, from);
              return <View key={d} accessibilityLabel={`${DAY_NAMES[d]} ${formatTime(from)}: ${m} minutes busy`}
                style={{ flex: 1, height: 26, borderRadius: 6, borderWidth: 1, borderColor: colors.border, backgroundColor: heat(m), alignItems: 'center', justifyContent: 'center' }}>
                {m > 0 && <T v="caption" color={m > 60 ? '#FFFFFF' : '#3A2A2C'} style={{ fontSize: 9, fontWeight: '700' }}>{m >= 60 ? `${Math.round(m / 6) / 10}h` : `${m}m`}</T>}
              </View>;
            })}
          </View>
        ))}
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: 4 }}>
          <T v="caption" color={colors.textSecondary}>Free</T>
          {[0, 30, 60, 90, 120].map((m) => <View key={m} style={{ width: 18, height: 12, borderRadius: 3, backgroundColor: heat(m), borderWidth: 1, borderColor: colors.border }} />)}
          <T v="caption" color={colors.textSecondary}>Busy</T>
        </View>
      </View>
      {top && top.min > 0 && (
        <View style={{ backgroundColor: colors.white, borderRadius: radius.card, padding: space.lg, borderWidth: 1, borderColor: colors.border }}>
          <T v="cardTitle">Busiest day: {DAY_NAMES[top.d]} · {formatDuration(top.min)}</T>
          <T v="caption" color={colors.textSecondary}>Total scheduled time across the week: {formatDuration(totals.reduce((s, t) => s + t.min, 0))}</T>
        </View>
      )}
    </>
  );
}

/** 2.2 Calendar – Month. Classes repeat weekly, so each date shows that weekday's events. */
function MonthView({ card, events, conflictIds, issueFor }: { card: (e: ScheduleEvent) => React.ReactNode; events: ScheduleEvent[]; conflictIds: Set<string>; issueFor: (id: string) => ReturnType<ReturnType<typeof useSchedule>['issueFor']> }) {
  const today = new Date();
  const [month, setMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [picked, setPicked] = useState(new Date(today.getFullYear(), today.getMonth(), today.getDate()));
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const cells = Array.from({ length: 42 }, (_, i) => new Date(month.getFullYear(), month.getMonth(), 1 - first.getDay() + i));
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  const dayEvents = (d: Date) => events.filter((e) => e.weekday === d.getDay());
  const shift = (n: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1));
  const label = month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  return (
    <>
      <View style={{ backgroundColor: colors.white, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border, padding: space.md, gap: space.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Button kind="text" icon="chevron-back" label="" onPress={() => shift(-1)} />
          <T v="cardTitle">{label}</T>
          <Button kind="text" icon="chevron-forward" label="" onPress={() => shift(1)} />
        </View>
        <Button kind="tonal" label="Today" onPress={() => { setMonth(new Date(today.getFullYear(), today.getMonth(), 1)); setPicked(today); }} style={{ alignSelf: 'flex-end', minHeight: 36 }} />
        <View style={{ flexDirection: 'row' }}>
          {DAY_SHORT.map((d) => <T key={d} v="captionStrong" color={colors.textSecondary} center style={{ flex: 1 }}>{d[0]}</T>)}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {cells.map((d) => {
            const inMonth = d.getMonth() === month.getMonth();
            const evs = dayEvents(d);
            const on = same(d, picked);
            const conflict = evs.some((e) => conflictIds.has(e.id));
            return (
              <Pressable key={d.toISOString()} onPress={() => setPicked(d)} accessibilityRole="button"
                accessibilityLabel={`${d.toDateString()}, ${evs.length} events${conflict ? ', has a conflict' : ''}`}
                style={{ width: `${100 / 7}%`, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: on ? colors.strawberryStrong : 'transparent' }}>
                <T v={same(d, today) ? 'captionStrong' : 'caption'} color={on ? colors.onAccent : inMonth ? colors.text : colors.disabled}>{d.getDate()}</T>
                <View style={{ flexDirection: 'row', gap: 2, height: 6, marginTop: 2 }}>
                  {inMonth && evs.slice(0, 3).map((e) => <View key={e.id} style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: conflictIds.has(e.id) ? colors.error : subjectColor(e, events), borderWidth: on ? 1 : 0, borderColor: colors.onAccent }} />)}
                </View>
              </Pressable>
            );
          })}
        </View>
        <View style={{ flexDirection: 'row', gap: space.md }}>
          <T v="caption" color={colors.textSecondary}>● Dot color = subject</T>
          <T v="caption" color={colors.error}>● Conflict</T>
        </View>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <T v="cardTitle">{picked.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} · {dayEvents(picked).length} events</T>
        <Button kind="text" icon="add" label="Add Event" onPress={() => router.push('/event/new')} />
      </View>
      {dayEvents(picked).map(card)}
      <FreeDay events={events} day={picked.getDay() as Weekday} label={picked.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })} issueFor={issueFor} />
    </>
  );
}

/** When a day has no events, says so and shows the closest event after it. */
function FreeDay({ events, day, label, issueFor }: { events: ScheduleEvent[]; day: Weekday; label: string; issueFor: ReturnType<typeof useSchedule>['issueFor'] }) {
  if (events.some((e) => e.weekday === day)) return null;
  const next = nextEvent(events, ((day + 1) % 7) as Weekday);
  return (
    <>
      <Banner tone="matcha" title={`You're free on ${label}`} message="Nothing scheduled this day." />
      {next && (
        <>
          <T v="captionStrong" color={colors.textSecondary}>NEXT UP · {DAY_NAMES[next.event.weekday].toUpperCase()}</T>
          <EventCard event={next.event} issue={issueFor(next.event.id)} onPress={() => router.push(`/event/${next.event.id}`)} />
        </>
      )}
    </>
  );
}
