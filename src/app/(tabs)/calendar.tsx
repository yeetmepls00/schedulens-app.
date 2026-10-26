// Calendar: Day, Week, Month, List, and Heatmap views of the weekly schedule.
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { EventCard } from '../../components/EventCard';
import { Button, Chip, Empty, Screen, Segmented, T } from '../../components/ui';
import { getSetting } from '../../data/db';
import { useSchedule } from '../../data/hooks';
import { DAY_NAMES, DAY_SHORT, formatDuration, formatTime } from '../../lib/time';
import type { ScheduleEvent, Weekday } from '../../lib/types';
import { colors, radius, space } from '../../theme/tokens';

type View_ = 'day' | 'week' | 'month' | 'list' | 'heatmap';
const WEEK: Weekday[] = [1, 2, 3, 4, 5, 6, 0];
const START = 7 * 60;
const END = 21 * 60;

export default function Calendar() {
  const { events, issueFor, issues } = useSchedule();
  const [view, setView] = useState<View_>(() => getSetting<View_>('defaultView', 'day'));
  const [day, setDay] = useState<Weekday>(new Date().getDay() as Weekday);
  const add = <Button label="Add" kind="text" icon="add" onPress={() => router.push('/event/new')} />;

  return (
    <Screen title="Calendar" right={add}>
      <Button kind="tonal" icon="color-palette" label="Timetable editor" onPress={() => router.push('/timetable')} />
      <Segmented value={view} onChange={setView} options={[{ key: 'day', label: 'Day' }, { key: 'week', label: 'Week' }, { key: 'month', label: 'Month' }, { key: 'list', label: 'List' }, { key: 'heatmap', label: 'Heatmap' }]} />
      {events.length === 0 ? (
        <Empty icon="calendar-outline" title="Your calendar is empty" message="Import a schedule or add an event." action="Add event" onAction={() => router.push('/event/new')} />
      ) : view === 'day' ? (
        <>
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            {WEEK.map((d) => <Chip key={d} label={DAY_SHORT[d]} on={d === day} onPress={() => setDay(d)} />)}
          </View>
          <T v="cardTitle">{DAY_NAMES[day]} · {events.filter((e) => e.weekday === day).length} events</T>
          {events.filter((e) => e.weekday === day).map((e) => <EventCard key={e.id} event={e} issue={issueFor(e.id)} onPress={() => router.push(`/event/${e.id}`)} />)}
        </>
      ) : view === 'week' ? (
        <WeekGrid events={events} conflictIds={new Set(issues.filter((i) => i.kind === 'overlap').flatMap((i) => i.eventIds))} />
      ) : view === 'month' ? (
        <MonthView events={events} conflictIds={new Set(issues.filter((i) => i.kind === 'overlap').flatMap((i) => i.eventIds))} issueFor={issueFor} />
      ) : view === 'list' ? (
        WEEK.filter((d) => events.some((e) => e.weekday === d)).map((d) => (
          <View key={d} style={{ gap: space.sm }}>
            <T v="captionStrong" color={colors.textSecondary}>{DAY_NAMES[d].toUpperCase()}</T>
            {events.filter((e) => e.weekday === d).map((e) => <EventCard key={e.id} event={e} issue={issueFor(e.id)} onPress={() => router.push(`/event/${e.id}`)} />)}
          </View>
        ))
      ) : (
        <Heatmap events={events} />
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
              return (
                <Pressable key={e.id} onPress={() => router.push(`/event/${e.id}`)} accessibilityLabel={`${e.title} ${formatTime(e.startMin)}`}
                  style={{ position: 'absolute', left: 2, right: 2, top: ((Math.max(e.startMin, START) - START) / 60) * hourH, height: Math.max(18, ((Math.min(e.endMin, END) - Math.max(e.startMin, START)) / 60) * hourH - 2), backgroundColor: bad ? colors.errorSurface : colors.strawberrySoft, borderColor: bad ? colors.error : colors.strawberry, borderWidth: 1, borderRadius: 6, padding: 2, overflow: 'hidden' }}>
                  <T v="caption" style={{ fontSize: 10, fontWeight: '700' }} lines={3}>{e.title}</T>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

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
                style={{ flex: 1, height: 26, borderRadius: 6, borderWidth: 1, borderColor: colors.border, backgroundColor: m === 0 ? colors.card : colors.strawberry, opacity: m === 0 ? 1 : 0.3 + 0.7 * (m / 120) }} />;
            })}
          </View>
        ))}
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: 4 }}>
          <T v="caption" color={colors.textSecondary}>Free</T>
          {[0, 0.4, 0.7, 1].map((o) => <View key={o} style={{ width: 18, height: 12, borderRadius: 3, backgroundColor: o ? colors.strawberry : colors.card, opacity: o || 1, borderWidth: 1, borderColor: colors.border }} />)}
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
function MonthView({ events, conflictIds, issueFor }: { events: ScheduleEvent[]; conflictIds: Set<string>; issueFor: (id: string) => ReturnType<ReturnType<typeof useSchedule>['issueFor']> }) {
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
                  {inMonth && evs.slice(0, 3).map((e) => <View key={e.id} style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: on ? colors.onAccent : conflictIds.has(e.id) ? colors.error : colors.matcha }} />)}
                </View>
              </Pressable>
            );
          })}
        </View>
        <View style={{ flexDirection: 'row', gap: space.md }}>
          <T v="caption" color={colors.textSecondary}>● Has events</T>
          <T v="caption" color={colors.error}>● Conflict</T>
        </View>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <T v="cardTitle">{picked.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} · {dayEvents(picked).length} events</T>
        <Button kind="text" icon="add" label="Add Event" onPress={() => router.push('/event/new')} />
      </View>
      {dayEvents(picked).map((e) => <EventCard key={e.id} event={e} issue={issueFor(e.id)} onPress={() => router.push(`/event/${e.id}`)} />)}
    </>
  );
}
