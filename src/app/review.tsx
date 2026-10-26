// Review: every overlap, travel, and workload warning in one list.
import { router } from 'expo-router';
import { View } from 'react-native';
import { EventCard } from '../components/EventCard';
import { Button, Card, Empty, Screen, T } from '../components/ui';
import { useSchedule } from '../data/hooks';
import { DAY_NAMES } from '../lib/time';
import { colors, space } from '../theme/tokens';

const LABEL = { overlap: 'Overlap', travel: 'Short travel time', workload: 'Long stretch' } as const;

export default function Review() {
  const { events, issues } = useSchedule();
  const byId = new Map(events.map((e) => [e.id, e]));
  return (
    <Screen title="Schedule check" back footer={<Button label="Go to calendar" onPress={() => router.replace('/calendar')} />}>
      {issues.length === 0 ? (
        <Empty icon="checkmark-circle-outline" title="No problems found" message="No overlaps, short travel gaps, or long stretches without a break." />
      ) : (
        <>
          <T color={colors.textSecondary}>These checks use simple rules you can change in Settings. Travel warnings are based on the gap between events, not on real distance. Workload notes are reminders, not health advice.</T>
          {issues.map((iss, n) => {
            const e = byId.get(iss.eventIds[iss.eventIds.length - 1]) ?? byId.get(iss.eventIds[0]);
            return (
              <View key={n} style={{ gap: space.xs }}>
                <T v="captionStrong" color={colors.textSecondary}>{DAY_NAMES[iss.weekday]} · {LABEL[iss.kind]}</T>
                {e ? <EventCard event={e} issue={iss} onPress={() => router.push(`/event/${e.id}`)} /> : <Card><T>{iss.message}</T></Card>}
                {e && <T v="caption" color={colors.textSecondary}>{iss.message}</T>}
              </View>
            );
          })}
        </>
      )}
    </Screen>
  );
}
