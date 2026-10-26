// Home: today's events, warnings, and shortcuts.
import { SummaryGlyph, SummaryIconEditor, type SlotId } from '../../components/summary-icons';
import { useEffect, useState } from 'react';
import { groupsConfigured, recentJoins, savedGroups, type JoinNotice } from '../../lib/groups';
import { Avatar } from '../../components/avatar';
import { InstallApp } from '../../components/install-app';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { EventCard } from '../../components/EventCard';
import { Banner, Empty, Icon, Screen, T, type IconName } from '../../components/ui';
import { getSetting } from '../../data/db';
import { useSchedule } from '../../data/hooks';
import { nextEvent, whenLabel } from '../../lib/next';
import { DAY_NAMES, DAY_SHORT, formatDuration, formatTime } from '../../lib/time';
import type { Weekday } from '../../lib/types';
import { colors, radius, space, WHIMSY } from '../../theme/tokens';

const TIPS = [
  'Tap an event in the Timetable editor to give it its own color.',
  'Share your group code so friends can find free time with you.',
  'Pull down at the top of any screen to refresh.',
  'Save a backup in Settings before switching phones.',
  'Check the Heatmap to see your busiest hours.',
  'Add an event to several days at once: tap Mon, then Fri.',
];

export default function Home() {
  const { events, issues, issueFor } = useSchedule();
  const now = new Date();
  const today = now.getDay() as Weekday;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const todays = events.filter((e) => e.weekday === today);
  const upcoming = todays.filter((e) => e.endMin > nowMin);
  const next = upcoming.length === 0 ? nextEvent(events, ((today + 1) % 7) as Weekday) : null;
  const busyMin = todays.reduce((m, e) => m + e.endMin - e.startMin, 0);
  const soon = upcoming.find((e) => e.startMin > nowMin);
  const mood = events.length === 0 ? { emoji: '🌱', line: "Let's set up your week!" }
    : upcoming.some((e) => e.startMin <= nowMin) ? { emoji: '📖', line: 'Event in progress. You got this!' }
    : soon ? { emoji: '🍓', line: `Next: ${soon.title} at ${formatTime(soon.startMin)}` }
    : todays.length ? { emoji: '🎉', line: 'All done for today. Great job!' }
    : { emoji: '☁️', line: 'A free day. Time to recharge!' };
  const [editing, setEditing] = useState<SlotId | null>(null);
  // Someone joined one of your groups since you last opened Notifications.
  const [joins, setJoins] = useState<JoinNotice[]>([]);
  useEffect(() => {
    if (!groupsConfigured) return;
    const since = getSetting('joinsSeenAt', new Date(Date.now() - 7 * 864e5).toISOString());
    recentJoins(savedGroups(), since).then(setJoins).catch(() => {});
  }, []);
  const todaysIssues = issues.filter((i) => i.weekday === today);
  const name = getSetting('displayName', '');
  const hello = now.getHours() < 12 ? 'Good morning' : now.getHours() < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <Pressable onPress={() => router.push('/settings')} accessibilityRole="button" accessibilityLabel="Profile and settings"
>
          <Avatar name={name} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <T v="caption" color={colors.textSecondary}>{hello},</T>
          <T v="screenTitle">{name || 'there'}</T>
        </View>
        <Pressable onPress={() => router.push('/settings')} accessibilityRole="button" accessibilityLabel="Settings"
          style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="settings-outline" color={colors.text} />
        </Pressable>
        <Pressable onPress={() => router.push('/notifications')} accessibilityRole="button" accessibilityLabel={`Notifications${todaysIssues.length ? `, ${todaysIssues.length} new` : ''}`}
          style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="notifications-outline" color={colors.text} />
          {(todaysIssues.length > 0 || joins.length > 0) && <View style={{ position: 'absolute', top: 10, right: 12, width: 10, height: 10, borderRadius: 5, backgroundColor: colors.strawberry }} />}
        </Pressable>
      </View>

      <LinearGradient colors={['#FFD6DC', '#FFF1E6', '#E3F0D3']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ borderRadius: 24, padding: space.lg, gap: space.md, overflow: 'hidden' }}>
        <Pressable onPress={() => setEditing('mascot')} accessibilityRole="button" accessibilityLabel="Change card mascot" style={{ position: 'absolute', right: 12, top: 8, zIndex: 1 }}>
          <SummaryGlyph slot="mascot" size={44} fallback={mood.emoji} />
        </Pressable>
        <View style={{ paddingRight: 56 }}>
          <T v="captionStrong" color={colors.strawberryStrong}>{now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</T>
          <T v="cardTitle">{mood.line}</T>
        </View>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          {([[String(todays.length), 'on today', 'today', '#FFE3E8'], [`${Math.round(busyMin / 6) / 10}h`, 'busy for', 'busy', '#E3F0D3'], [String(upcoming.length), 'left to go', 'left', '#FFF0D6']] as const).map(([n, l, d, bg]) => (
            <View key={l} style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.8)', borderRadius: 18, padding: 10, alignItems: 'center', borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#F3C6CE' }}>
              <Pressable onPress={() => setEditing(d)} accessibilityRole="button" accessibilityLabel={`Change ${l} icon`} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}><SummaryGlyph slot={d} size={22} /></Pressable>
              <T style={{ fontFamily: WHIMSY, fontSize: 24, lineHeight: 28 }}>{n}</T>
              <T v="caption" color={colors.textSecondary} center>{l}</T>
            </View>
          ))}
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          {([1, 2, 3, 4, 5, 6, 0] as Weekday[]).map((d) => {
            const n = events.filter((e) => e.weekday === d).length;
            const on = d === today;
            return (
              <Pressable key={d} onPress={() => router.push('/calendar')} accessibilityLabel={`${DAY_NAMES[d]}, ${n} events`}
                style={{ width: 38, paddingVertical: 6, borderRadius: 14, alignItems: 'center', gap: 3, backgroundColor: on ? colors.strawberryStrong : 'rgba(255,255,255,0.6)' }}>
                <T v="captionStrong" color={on ? colors.onAccent : colors.text} style={{ fontSize: 11 }}>{DAY_SHORT[d]}</T>
                <View style={{ flexDirection: 'row', gap: 2, height: 5 }}>
                  {Array.from({ length: Math.min(n, 3) }, (_, i) => <View key={i} style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: on ? colors.onAccent : colors.strawberry }} />)}
                </View>
              </Pressable>
            );
          })}
        </View>
        <T v="caption" color={colors.textSecondary} center>Tap an icon to change it ✎</T>
      </LinearGradient>
      <SummaryIconEditor slot={editing} onClose={() => setEditing(null)} />

      {joins.length > 0 && (
        <Banner tone="matcha" title={joins.length === 1 ? `${joins[0].name} joined ${joins[0].groupName} 🎉` : `${joins.length} new members joined your groups 🎉`}
          message="Say hi and plan something together." action="See" onAction={() => router.push('/notifications')} />
      )}
      {todaysIssues.length > 0 && (
        <Banner tone={todaysIssues.some((i) => i.kind === 'overlap') ? 'error' : 'warning'}
          title={`${todaysIssues.length} ${todaysIssues.length === 1 ? 'thing' : 'things'} to check today`}
          message={todaysIssues[0].message} action="Review" onAction={() => router.push('/review')} />
      )}

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <T v="section">Today · {DAY_NAMES[today]}</T>
        <Pressable onPress={() => router.push('/calendar')} hitSlop={12}><T v="captionStrong" color={colors.strawberryStrong}>See all</T></Pressable>
      </View>

      {events.length === 0 ? (
        <Empty icon="calendar-outline" title="No schedule yet" message="Scan or upload your schedule (classes, meetings, work) to get started." action="Add a schedule" onAction={() => router.push('/scan')} />
      ) : upcoming.length === 0 ? (
        <>
          <Banner tone="matcha" title={todays.length ? "You're free for the rest of today" : "You're free today"} message={todays.length ? `${todays.length} ${todays.length === 1 ? 'event' : 'events'} earlier today.` : 'Nothing scheduled today. Enjoy the break.'} />
          {next && (
            <>
              <T v="captionStrong" color={colors.textSecondary}>NEXT UP · {whenLabel(next.daysAhead + 1, next.event.weekday).toUpperCase()}</T>
              <EventCard event={next.event} issue={issueFor(next.event.id)} onPress={() => router.push(`/event/${next.event.id}`)} />
            </>
          )}
        </>
      ) : (
        upcoming.map((e) => <EventCard key={e.id} event={e} issue={issueFor(e.id)} onPress={() => router.push(`/event/${e.id}`)} />)
      )}

      <T v="section">Quick access</T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>
        {([['Scan schedule', 'Camera or file', 'camera', '/scan', '#FFE3E8', '#C2324F'], ['Calendar', 'Day to heatmap', 'calendar', '/calendar', '#E3F0D3', '#4E7A2E'], ['Groups', 'Find free time', 'people', '/groups', '#E4E9FF', '#4458C4'], ['Vault', 'Saved schedules', 'folder', '/vault', '#FFF0D6', '#B26A00'], ['Schedule check', 'Overlaps and gaps', 'checkmark-done', '/review', '#EBE2FF', '#6B46C1'], ['Settings', 'Profile and app', 'settings-outline', '/settings', '#DDF3F1', '#1F7A70']] as const).map(([label, sub, icon, href, bg, fg]) => (
          <Pressable key={label} onPress={() => router.push(href)} accessibilityRole="button"
            style={{ width: '47%', flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, backgroundColor: colors.white, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border, minHeight: 64 }}>
            <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={icon as IconName} color={fg} size={20} />
            </View>
            <View style={{ flex: 1 }}>
              <T v="captionStrong">{label}</T>
              <T v="caption" color={colors.textSecondary}>{sub}</T>
            </View>
          </Pressable>
        ))}
      </View>
      <View style={{ backgroundColor: colors.white, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border, padding: space.md, flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
        <T style={{ fontSize: 26 }}>💡</T>
        <View style={{ flex: 1 }}>
          <T v="captionStrong">Tip of the day</T>
          <T v="caption" color={colors.textSecondary}>{TIPS[now.getDate() % TIPS.length]}</T>
        </View>
      </View>
      <InstallApp hideWhenInstalled />
    </Screen>
  );
}
