// Home: today's events, warnings, and shortcuts.
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { EventCard } from '../../components/EventCard';
import { Banner, Empty, Icon, Screen, T, type IconName } from '../../components/ui';
import { getSetting } from '../../data/db';
import { useSchedule } from '../../data/hooks';
import { DAY_NAMES } from '../../lib/time';
import type { Weekday } from '../../lib/types';
import { colors, radius, space } from '../../theme/tokens';

export default function Home() {
  const { events, issues, issueFor } = useSchedule();
  const now = new Date();
  const today = now.getDay() as Weekday;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const todays = events.filter((e) => e.weekday === today);
  const upcoming = todays.filter((e) => e.endMin > nowMin);
  const todaysIssues = issues.filter((i) => i.weekday === today);
  const name = getSetting('displayName', '');
  const hello = now.getHours() < 12 ? 'Good morning' : now.getHours() < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <Pressable onPress={() => router.push('/settings')} accessibilityRole="button" accessibilityLabel="Profile and settings"
          style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.white, borderWidth: 2, borderColor: colors.strawberry, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="person" color={colors.strawberryStrong} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <T v="caption" color={colors.textSecondary}>{hello},</T>
          <T v="screenTitle">{name || 'there'}</T>
        </View>
        <Pressable onPress={() => router.push('/notifications')} accessibilityRole="button" accessibilityLabel={`Notifications${todaysIssues.length ? `, ${todaysIssues.length} new` : ''}`}
          style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="notifications-outline" color={colors.text} />
          {todaysIssues.length > 0 && <View style={{ position: 'absolute', top: 10, right: 12, width: 10, height: 10, borderRadius: 5, backgroundColor: colors.strawberry }} />}
        </Pressable>
      </View>

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
        <Empty icon="calendar-outline" title="No schedule yet" message="Scan or upload your class schedule to get started." action="Add a schedule" onAction={() => router.push('/scan')} />
      ) : upcoming.length === 0 ? (
        <Banner tone="matcha" title="You're free for the rest of today" message={todays.length ? `${todays.length} events earlier today.` : 'Nothing scheduled today.'} />
      ) : (
        upcoming.map((e) => <EventCard key={e.id} event={e} issue={issueFor(e.id)} onPress={() => router.push(`/event/${e.id}`)} />)
      )}

      <T v="section">Quick access</T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>
        {([['Scan schedule', 'Camera or file', 'camera', '/scan'], ['Calendar', 'Day to heatmap', 'calendar', '/calendar'], ['Groups', 'Find free time', 'people', '/groups'], ['Vault', 'Saved schedules', 'folder', '/vault']] as const).map(([label, sub, icon, href]) => (
          <Pressable key={label} onPress={() => router.push(href)} accessibilityRole="button"
            style={{ width: '47%', flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, backgroundColor: colors.white, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border, minHeight: 64 }}>
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.matchaSoft, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={icon as IconName} color={colors.matchaStrong} size={20} />
            </View>
            <View style={{ flex: 1 }}>
              <T v="captionStrong">{label}</T>
              <T v="caption" color={colors.textSecondary}>{sub}</T>
            </View>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}
