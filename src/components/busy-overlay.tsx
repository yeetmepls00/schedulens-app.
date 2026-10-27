// Lays every member's busy times for one day on top of each other, so the
// group can see at a glance who is busy when and where everyone is free.
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { DAY_NAMES, DAY_SHORT, formatTime } from '../lib/time';
import type { MemberBusy } from '../lib/groups';
import type { Weekday } from '../lib/types';
import { colors, radius, space } from '../theme/tokens';
import { T } from './ui';

export const START = 7 * 60, END = 21 * 60, STEP = 30;
const MEMBER_COLORS = ['#E8708A', '#6FA8DC', '#F4B860', '#9CC27A', '#B48EDB', '#F28C6B', '#4DB6AC', '#C9A27E'];
const pct = (m: number) => `${((m - START) / (END - START)) * 100}%` as const;

export function DayOverlay({ members, day, colorOf, plans = [], title }: {
  members: MemberBusy[]; day: Weekday; colorOf?: (i: number) => string;
  /** Group activities on this day, drawn as their own row. */
  plans?: { title: string; startMin: number; endMin: number }[]; title?: string;
}) {
  const col = (i: number) => colorOf?.(i) ?? MEMBER_COLORS[i % MEMBER_COLORS.length];
  const [pick, setPick] = useState<number | null>(null);
  const slots = Array.from({ length: (END - START) / STEP }, (_, i) => START + i * STEP);
  const busyAt = (m: MemberBusy, t: number) => m.blocks.some((b) => b.weekday === day && b.startMin < t + STEP && b.endMin > t);
  const who = (t: number) => members.filter((m) => busyAt(m, t));
  const nameW = 76;

  return (
    <View style={{ backgroundColor: colors.white, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border, padding: space.md, gap: 8 }}>
      <T v="cardTitle">{title ?? `${DAY_NAMES[day]} by member`}</T>
      <T v="caption" color={colors.textSecondary}>Each row is one member's busy time. Tap the top row to see who's busy at that time.</T>

      {/* Everyone combined */}
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <T v="captionStrong" style={{ width: nameW }}>Everyone</T>
        <View style={{ flex: 1, height: 30, flexDirection: 'row', borderRadius: 8, overflow: 'hidden' }}>
          {slots.map((t) => {
            const n = who(t).length;
            const bg = n === 0 ? '#7BC47F' : `rgba(217,48,37,${0.18 + 0.67 * (n / Math.max(1, members.length))})`;
            return (
              <Pressable key={t} onPress={() => setPick(pick === t ? null : t)} accessibilityRole="button"
                accessibilityLabel={`${formatTime(t)}: ${n === 0 ? 'everyone free' : `${n} busy`}`}
                style={{ flex: 1, backgroundColor: bg, borderRightWidth: 1, borderColor: 'rgba(255,255,255,0.6)', borderWidth: pick === t ? 2 : 0 }} />
            );
          })}
        </View>
      </View>

      {/* One row per member */}
      {members.map((m, i) => (
        <View key={m.userId} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: nameW, flexDirection: 'row', alignItems: 'center', gap: 4, paddingRight: 4 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: col(i) }} />
            <T v="caption" lines={1} style={{ flex: 1 }}>{m.displayName}</T>
          </View>
          <View style={{ flex: 1, height: 20, backgroundColor: '#F3EEEE', borderRadius: 6, overflow: 'hidden' }}>
            {m.blocks.filter((b) => b.weekday === day && b.endMin > START && b.startMin < END).map((b, k) => (
              <View key={k} style={{ position: 'absolute', top: 0, bottom: 0, left: pct(Math.max(START, b.startMin)),
                width: `${((Math.min(END, b.endMin) - Math.max(START, b.startMin)) / (END - START)) * 100}%`,
                backgroundColor: col(i), opacity: 0.85 }} />
            ))}
            {pick !== null && <View style={{ position: 'absolute', top: 0, bottom: 0, left: pct(pick), width: `${(STEP / (END - START)) * 100}%`, borderWidth: 1.5, borderColor: colors.text }} />}
          </View>
        </View>
      ))}

      {plans.length > 0 && (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: nameW, flexDirection: 'row', alignItems: 'center', gap: 4, paddingRight: 4 }}>
            <T v="caption" style={{ fontSize: 12 }}>⭐</T>
            <T v="captionStrong" lines={1} style={{ flex: 1 }}>Group plan</T>
          </View>
          <View style={{ flex: 1, height: 20, backgroundColor: '#F3EEEE', borderRadius: 6, overflow: 'hidden' }}>
            {plans.filter((b) => b.endMin > START && b.startMin < END).map((b, k) => (
              <View key={k} style={{ position: 'absolute', top: 0, bottom: 0, left: pct(Math.max(START, b.startMin)),
                width: `${((Math.min(END, b.endMin) - Math.max(START, b.startMin)) / (END - START)) * 100}%`,
                backgroundColor: colors.text, borderRadius: 4 }} />
            ))}
          </View>
        </View>
      )}
      {/* Hour labels */}
      <View style={{ flexDirection: 'row', marginLeft: nameW, height: 16 }}>
        {[7, 10, 13, 16, 19, 21].map((h) => (
          <T key={h} v="caption" color={colors.textSecondary} style={{ position: 'absolute', left: pct(h * 60), marginLeft: h === 21 ? -30 : h === 7 ? 0 : -14, fontSize: 11 }}>
            {formatTime(h * 60).replace(':00', '')}
          </T>
        ))}
      </View>

      {pick !== null && (() => {
        const b = who(pick), free = members.filter((m) => !b.includes(m));
        return (
          <View style={{ backgroundColor: colors.card, borderRadius: 10, padding: space.sm, gap: 2 }}>
            <T v="captionStrong">{formatTime(pick)} – {formatTime(pick + STEP)}</T>
            <T v="caption">{b.length ? `Busy: ${b.map((m) => m.displayName).join(', ')}` : 'Everyone is free 🎉'}</T>
            {b.length > 0 && free.length > 0 && <T v="caption" color={colors.textSecondary}>Free: {free.map((m) => m.displayName).join(', ')}</T>}
          </View>
        );
      })()}
    </View>
  );
}

const busyAt = (m: MemberBusy, day: Weekday, t: number, len = STEP) => m.blocks.some((b) => b.weekday === day && b.startMin < t + len && b.endMin > t);
const ORDER: Weekday[] = [1, 2, 3, 4, 5, 6, 0];
const heat = (n: number, total: number) => (n === 0 ? '#7BC47F' : `rgba(217,48,37,${0.15 + 0.7 * (n / Math.max(1, total))})`);

/** The whole week at a glance: one column per day, one row per hour, colored by how many are busy. */
export function WeekOverlay({ members, day, onDay }: { members: MemberBusy[]; day: Weekday; onDay: (d: Weekday) => void }) {
  const [pick, setPick] = useState<{ d: Weekday; t: number } | null>(null);
  const hours = Array.from({ length: (END - START) / 60 }, (_, i) => START + i * 60);
  const total = members.length;
  return (
    <View style={{ backgroundColor: colors.white, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border, padding: space.md, gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <T v="cardTitle">Group availability</T>
        <T v="caption" color={colors.textSecondary}>{total} {total === 1 ? 'member' : 'members'}</T>
      </View>
      <T v="caption" color={colors.textSecondary}>Everyone's schedules laid on top of each other. Tap a box to see who's busy, or a day to see it member by member.</T>
      <View style={{ flexDirection: 'row', marginLeft: 44 }}>
        {ORDER.map((d) => (
          <Pressable key={d} onPress={() => onDay(d)} accessibilityRole="button" accessibilityState={{ selected: d === day }} accessibilityLabel={DAY_NAMES[d]}
            style={{ flex: 1, alignItems: 'center', paddingVertical: 4, borderRadius: 8, backgroundColor: d === day ? colors.text : 'transparent' }}>
            <T v="captionStrong" color={d === day ? colors.white : colors.text}>{DAY_SHORT[d]}</T>
          </Pressable>
        ))}
      </View>
      {hours.map((t) => (
        <View key={t} style={{ flexDirection: 'row', alignItems: 'center', height: 24 }}>
          <T v="caption" color={colors.textSecondary} style={{ width: 44, fontSize: 11 }}>{formatTime(t).replace(':00', '')}</T>
          {ORDER.map((d) => {
            const n = members.filter((m) => busyAt(m, d, t, 60)).length;
            const on = pick?.d === d && pick.t === t;
            return (
              <Pressable key={d} onPress={() => { setPick(on ? null : { d, t }); onDay(d); }} accessibilityRole="button"
                accessibilityLabel={`${DAY_NAMES[d]} ${formatTime(t)}: ${n === 0 ? 'everyone free' : `${n} of ${total} busy`}`}
                style={{ flex: 1, height: 22, marginHorizontal: 1, borderRadius: 4, backgroundColor: heat(n, total), borderWidth: on ? 2 : 0, borderColor: colors.text, alignItems: 'center', justifyContent: 'center' }}>
                {n > 0 && total > 1 && <T v="caption" color="#fff" style={{ fontSize: 10, fontWeight: '800' }}>{n}</T>}
              </Pressable>
            );
          })}
        </View>
      ))}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <View style={{ width: 14, height: 14, borderRadius: 3, backgroundColor: heat(0, total) }} /><T v="caption">All free</T>
        <View style={{ width: 14, height: 14, borderRadius: 3, backgroundColor: heat(1, Math.max(2, total)), marginLeft: 8 }} /><T v="caption">Some busy</T>
        <View style={{ width: 14, height: 14, borderRadius: 3, backgroundColor: heat(total, total), marginLeft: 8 }} /><T v="caption">All busy</T>
      </View>
      {pick && (() => {
        const b = members.filter((m) => busyAt(m, pick.d, pick.t, 60)), free = members.filter((m) => !b.includes(m));
        return (
          <View style={{ backgroundColor: colors.card, borderRadius: 10, padding: space.sm, gap: 2 }}>
            <T v="captionStrong">{DAY_NAMES[pick.d]}, {formatTime(pick.t)} – {formatTime(pick.t + 60)}</T>
            <T v="caption">{b.length ? `Busy: ${b.map((m) => m.displayName).join(', ')}` : 'Everyone is free 🎉'}</T>
            {b.length > 0 && free.length > 0 && <T v="caption" color={colors.textSecondary}>Free: {free.map((m) => m.displayName).join(', ')}</T>}
          </View>
        );
      })()}
    </View>
  );
}

export interface Window { startMin: number; endMin: number; free: MemberBusy[]; busy: MemberBusy[] }
/** Splits a day into stretches where the same people are free, keeping those where at least half are free. */
export function freeWindows(members: MemberBusy[], day: Weekday, minLen = 30): Window[] {
  const out: Window[] = [];
  for (let t = START; t < END; t += STEP) {
    const busy = members.filter((m) => busyAt(m, day, t));
    const key = busy.map((m) => m.userId).join(',');
    const last = out[out.length - 1];
    if (last && last.endMin === t && last.busy.map((m) => m.userId).join(',') === key) last.endMin = t + STEP;
    else out.push({ startMin: t, endMin: t + STEP, busy, free: members.filter((m) => !busy.includes(m)) });
  }
  return out
    .filter((w) => w.endMin - w.startMin >= minLen && w.free.length > 0 && w.free.length * 2 >= members.length)
    .sort((a, b) => a.busy.length - b.busy.length || a.startMin - b.startMin);
}
