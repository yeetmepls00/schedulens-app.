// Review: every overlap, travel, and workload warning in one list.
import { router } from 'expo-router';
import { View } from 'react-native';
import { Badge, Button, Card, Empty, Screen, T } from '../components/ui';
import { useSchedule } from '../data/hooks';
import { DAY_NAMES, formatTime } from '../lib/time';
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
          {issues.map((iss, n) => (
            <Card key={n} style={{ gap: space.sm }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Badge tone={iss.kind === 'overlap' ? 'error' : 'warning'} label={LABEL[iss.kind]} />
                <T v="captionStrong" color={colors.textSecondary}>{DAY_NAMES[iss.weekday]}</T>
              </View>
              <T>{iss.message}</T>
              {iss.eventIds.map((id) => {
                const e = byId.get(id);
                return e ? <Button key={id} kind="text" label={`Edit ${e.title} (${formatTime(e.startMin)})`} onPress={() => router.push(`/event/${id}`)} /> : null;
              })}
            </Card>
          ))}
        </>
      )}
    </Screen>
  );
}
