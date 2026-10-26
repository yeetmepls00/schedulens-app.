// Home: today's events, warnings, and shortcuts.
import { Doodle, type DoodleName } from '../../components/doodles';
import { Avatar } from '../../components/avatar';
import { InstallApp } from '../../components/install-app';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { EventCard } from '../../components/EventCard';
import { Banner, Empty, Screen, T } from '../../components/ui';
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
  const mood = events.length === 0 ? { doodle: 'pencil' as DoodleName, line: "Let's set up your week!" }
    : upcoming.some((e) => e.startMin <= nowMin) ? { doodle: 'book' as DoodleName, line: 'Event in progress. You got this!' }
    : soon ? { doodle: 'heart' as DoodleName, line: `Next: ${soon.title} at ${formatTime(soon.startMin)}` }
    : todays.length ? { doodle: 'star' as DoodleName, line: 'All done for today. Great job!' }
    : { doodle: 'sun' as DoodleName, line: 'A free day. Time to recharge!' };
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
          <Doodle name="gear" size={30} />
        </Pressable>
        <Pressable onPress={() => router.push('/notifications')} accessibilityRole="button" accessibilityLabel={`Notifications${todaysIssues.length ? `, ${todaysIssues.length} new` : ''}`}
          style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' }}>
          <Doodle name="bell" size={30} />
          {todaysIssues.length > 0 && <View style={{ position: 'absolute', top: 10, right: 12, width: 10, height: 10, borderRadius: 5, backgroundColor: colors.strawberry }} />}
        </Pressable>
      </View>

      <LinearGradient colors={['#FFD6DC', '#FFF1E6', '#E3F0D3']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ borderRadius: 24, padding: space.lg, gap: space.md, overflow: 'hidden' }}>
        <View style={{ position: 'absolute', right: 10, top: 8, transform: [{ rotate: '8deg' }] }}><Doodle name={mood.doodle} size={56} fill="#FFFFFF" color={colors.strawberryStrong} /></View>
        <View style={{ position: 'absolute', right: 74, top: 46, opacity: 0.7 }}><Doodle name="star" size={16} fill="#FFE9A8" /></View>
        <View style={{ paddingRight: 56 }}>
          <T v="captionStrong" color={colors.strawberryStrong}>{now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</T>
          <T v="cardTitle">{mood.line}</T>
        </View>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          {([[String(todays.length), 'on today', 'book', '#FFE3E8'], [`${Math.round(busyMin / 6) / 10}h`, 'busy for', 'clock', '#E3F0D3'], [String(upcoming.length), 'left to go', 'flag', '#FFF0D6']] as const).map(([n, l, d, bg]) => (
            <View key={l} style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.8)', borderRadius: 18, padding: 10, alignItems: 'center', borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#F3C6CE' }}>
              <Doodle name={d} size={30} fill={bg} />
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
      </LinearGradient>

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
        {([['Scan schedule', 'Camera or file', 'camera', '/scan', '#FFD6DE'], ['Calendar', 'Day to heatmap', 'calendar', '/calendar', '#DCEFC8'], ['Groups', 'Find free time', 'people', '/groups', '#DCE3FF'], ['Vault', 'Saved schedules', 'folder', '/vault', '#FFE8BF'], ['Schedule check', 'Overlaps and gaps', 'check', '/review', '#E7DCFF'], ['Settings', 'Profile and app', 'gear', '/settings', '#CFF0EC']] as const).map(([label, sub, icon, href, bg]) => (
          <Pressable key={label} onPress={() => router.push(href)} accessibilityRole="button"
            style={{ width: '47%', flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, backgroundColor: colors.white, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border, minHeight: 64 }}>
            <Doodle name={icon} size={44} fill={bg} />
            <View style={{ flex: 1 }}>
              <T v="captionStrong">{label}</T>
              <T v="caption" color={colors.textSecondary}>{sub}</T>
            </View>
          </Pressable>
        ))}
      </View>
      <View style={{ backgroundColor: colors.white, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border, padding: space.md, flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
        <Doodle name="pencil" size={36} fill="#FFE9A8" />
        <View style={{ flex: 1 }}>
          <T v="captionStrong">Tip of the day</T>
          <T v="caption" color={colors.textSecondary}>{TIPS[now.getDate() % TIPS.length]}</T>
        </View>
      </View>
      <InstallApp hideWhenInstalled />
    </Screen>
  );
}
