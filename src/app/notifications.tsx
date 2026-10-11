// 2.5 Notifications. Built from your own data: today's warnings and recent imports.
// (Phone push reminders are not built yet; this is the in-app list.)
import { router } from 'expo-router';
import { View } from 'react-native';
import { Badge, Button, Card, Empty, Screen, T } from '../components/ui';
import { useFiles } from '../data/db';
import { useSchedule } from '../data/hooks';
import { colors, space } from '../theme/tokens';

const TITLE = { overlap: 'Conflict', travel: 'Short travel time', workload: 'Long continuous activity' } as const;

export default function Notifications() {
  const { issues } = useSchedule();
  const files = useFiles();
  const today = new Date().getDay();
  const todays = issues.filter((i) => i.weekday === today);
  const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
  const recent = files.filter((f) => Date.parse(f.createdAt) >= weekAgo);
  const empty = todays.length === 0 && recent.length === 0;
  return (
    <Screen title="Notifications" back>
      {empty ? (
        <Empty icon="notifications-outline" title="You're all caught up" message="Warnings for today and new imports will show here." />
      ) : (
        <>
          {todays.length > 0 && <T v="section">Today</T>}
          {todays.map((i, n) => (
            <Card key={n} style={{ gap: space.sm }}>
              <Badge tone={i.kind === 'overlap' ? 'error' : 'warning'} label={TITLE[i.kind]} />
              <T>{i.message}</T>
              <View style={{ alignItems: 'flex-end' }}><Button kind="text" label="Review" onPress={() => router.push('/review')} /></View>
            </Card>
          ))}
          {recent.length > 0 && <T v="section">Earlier</T>}
          {recent.map((f) => (
            <Card key={f.id} style={{ gap: space.sm }}>
              <Badge tone="success" label="Schedule imported" />
              <T>{f.name}: {f.eventCount} {f.eventCount === 1 ? 'event' : 'events'} added.</T>
              <T v="caption" color={colors.textSecondary}>{new Date(f.createdAt).toLocaleDateString()}</T>
              <View style={{ alignItems: 'flex-end' }}><Button kind="text" label="View" onPress={() => router.push('/vault')} /></View>
            </Card>
          ))}
        </>
      )}
    </Screen>
  );
}
