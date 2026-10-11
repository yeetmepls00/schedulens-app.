import { Pressable, View } from 'react-native';
import type { ScheduleEvent, ScheduleIssue } from '../lib/types';
import { formatTime } from '../lib/time';
import { colors, radius, space } from '../theme/tokens';
import { Badge, Icon, T } from './ui';

/** One event. A colored strip and badge show any conflict or warning. */
export function EventCard({ event, issue, onPress }: { event: ScheduleEvent; issue?: ScheduleIssue; onPress?: () => void }) {
  const strip = issue?.kind === 'overlap' ? colors.error : issue ? colors.warning : colors.strawberry;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${event.title}, ${formatTime(event.startMin)} to ${formatTime(event.endMin)}${issue ? ', has a warning' : ''}`}
      style={{ flexDirection: 'row', backgroundColor: colors.white, borderRadius: radius.card, borderWidth: 1, borderColor: issue ? strip : colors.border, overflow: 'hidden' }}
    >
      <View style={{ width: 6, backgroundColor: strip }} />
      <View style={{ width: 76, padding: space.md, gap: 2 }}>
        <T v="captionStrong">{formatTime(event.startMin)}</T>
        <T v="caption" color={colors.textSecondary}>{formatTime(event.endMin)}</T>
      </View>
      <View style={{ flex: 1, paddingVertical: space.md, paddingRight: space.md, gap: 4 }}>
        <T v="cardTitle" lines={2}>{event.title}</T>
        {event.location ? (
          <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
            <Icon name="location-outline" size={14} color={colors.textSecondary} />
            <T v="caption" color={colors.textSecondary}>{event.location}</T>
          </View>
        ) : null}
        {event.organizer ? (
          <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
            <Icon name="person-outline" size={14} color={colors.textSecondary} />
            <T v="caption" color={colors.textSecondary}>{event.organizer}</T>
          </View>
        ) : null}
        {issue && <Badge tone={issue.kind === 'overlap' ? 'error' : 'warning'} label={issue.kind === 'overlap' ? 'Overlaps another event' : issue.kind === 'travel' ? 'Short travel time' : 'Long stretch, no break'} />}
      </View>
    </Pressable>
  );
}
