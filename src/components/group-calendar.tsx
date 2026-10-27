// One calendar the whole group shares: like the personal Month view, but each
// day shows a colored dot for every member who is busy that day and a star
// for planned group activities.
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import type { Activity, MemberBusy } from '../lib/groups';
import { isoDate, parseIso } from '../lib/repeat';
import { DAY_SHORT } from '../lib/time';
import { colors, radius, space } from '../theme/tokens';
import { Button, T } from './ui';

/** Whether a group activity happens on this date. */
export function activityOn(a: Activity, date: Date): boolean {
  const start = parseIso(a.day);
  if (a.repeat === 'once') return a.day === isoDate(date);
  if (date < start) return false;
  if (a.repeat === 'daily') return true;
  if (a.repeat === 'weekly') return date.getDay() === start.getDay();
  const last = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  return date.getDate() === Math.min(start.getDate(), last);
}

export function GroupCalendar({ members, activities, colorOf, picked, onPick }: {
  members: MemberBusy[]; activities: Activity[]; colorOf: (i: number) => string; picked: Date; onPick: (d: Date) => void;
}) {
  const today = new Date();
  const [month, setMonth] = useState(new Date(picked.getFullYear(), picked.getMonth(), 1));
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const cells = Array.from({ length: 42 }, (_, i) => new Date(month.getFullYear(), month.getMonth(), 1 - first.getDay() + i));
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  const busyOn = (d: Date) => members.map((m, i) => ({ m, i })).filter(({ m }) => m.blocks.some((b) => b.weekday === d.getDay()));
  const shift = (n: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1));

  return (
    <View style={{ backgroundColor: colors.white, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border, padding: space.md, gap: space.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Button kind="text" icon="chevron-back" label="" onPress={() => shift(-1)} />
        <T v="cardTitle">{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</T>
        <Button kind="text" icon="chevron-forward" label="" onPress={() => shift(1)} />
      </View>
      <View style={{ flexDirection: 'row' }}>
        {DAY_SHORT.map((d) => <T key={d} v="captionStrong" color={colors.textSecondary} center style={{ flex: 1 }}>{d[0]}</T>)}
      </View>
      {Array.from({ length: 6 }, (_, r) => (
        <View key={r} style={{ flexDirection: 'row' }}>
          {cells.slice(r * 7, r * 7 + 7).map((d) => {
            const inMonth = d.getMonth() === month.getMonth();
            const on = same(d, picked);
            const busy = busyOn(d);
            const plan = activities.some((a) => activityOn(a, d));
            return (
              <Pressable key={d.toISOString()} onPress={() => onPick(d)} accessibilityRole="button" accessibilityState={{ selected: on }}
                accessibilityLabel={`${d.toDateString()}: ${busy.length} busy${plan ? ', group activity' : ''}`}
                style={{ flex: 1, minHeight: 52, alignItems: 'center', paddingVertical: 4, margin: 1, borderRadius: 10,
                  backgroundColor: on ? colors.text : same(d, today) ? colors.header : 'transparent', opacity: inMonth ? 1 : 0.35 }}>
                <T v="captionStrong" color={on ? colors.white : colors.text}>{d.getDate()}{plan ? ' ⭐' : ''}</T>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 2, marginTop: 3, maxWidth: 34 }}>
                  {busy.slice(0, 6).map(({ m, i }) => <View key={m.userId} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colorOf(i), borderWidth: on ? 1 : 0, borderColor: colors.white }} />)}
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, alignItems: 'center' }}>
        {members.map((m, i) => (
          <View key={m.userId} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colorOf(i) }} />
            <T v="caption">{m.displayName}</T>
          </View>
        ))}
        <T v="caption">⭐ Group plan</T>
      </View>
      <T v="caption" color={colors.textSecondary}>A dot means that member is busy some time that day. Tap a day for the details.</T>
    </View>
  );
}
