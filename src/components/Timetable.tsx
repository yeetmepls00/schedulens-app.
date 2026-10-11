// Draws a weekly timetable in one of the designs from lib/timetable.ts.
// Used by the timetable editor, its preset previews, and nowhere else changes data.
import { Pressable, Text, View } from 'react-native';
import { DAY_NAMES, DAY_SHORT, formatTime } from '../lib/time';
import { colorFor, layoutDay, textOn, type TimetableStyle } from '../lib/timetable';
import type { ScheduleEvent } from '../lib/types';

export function Timetable({ events, style, selectedId, onSelect, compact, title }: {
  events: ScheduleEvent[];
  style: TimetableStyle;
  selectedId?: string;
  onSelect?: (e: ScheduleEvent) => void;
  /** Small, non-interactive version used for preset previews. */
  compact?: boolean;
  title?: string;
}) {
  const hours = Math.max(1, style.endHour - style.startHour);
  const hourH = compact ? 16 : style.hourHeight;
  const timeW = compact ? 0 : style.blockStyle === 'planner' ? 52 : 38;
  const fs = (n: number) => (compact ? Math.max(6, n * 0.55) : n * style.fontScale);
  const planner = style.blockStyle === 'planner';
  const visible = events.filter((e) => style.days.includes(e.weekday) && e.endMin > style.startHour * 60 && e.startMin < style.endHour * 60);
  const subjects = [...new Map(events.map((e) => [e.title.trim().toLowerCase(), e])).values()];

  return (
    <View style={{ backgroundColor: style.background, borderRadius: planner ? 4 : 16, padding: compact ? 4 : 8, borderWidth: planner ? 2 : 1, borderColor: style.gridLine }}>
      {title && !compact && (
        <Text style={{ color: style.text, fontSize: fs(planner ? 18 : 15), fontWeight: '700', marginBottom: 6, textAlign: planner ? 'left' : 'center', fontFamily: planner ? 'Georgia, serif' : undefined }}>{title}</Text>
      )}
      <View style={{ flexDirection: 'row', marginLeft: timeW }}>
        {style.days.map((d) => (
          <Text key={d} style={{ flex: 1, textAlign: 'center', color: style.mutedText, fontSize: fs(11), fontWeight: '700', paddingBottom: 4, textTransform: planner ? 'uppercase' : 'none' }}>
            {compact ? DAY_SHORT[d].slice(0, 1) : planner ? DAY_NAMES[d].slice(0, 3) : DAY_SHORT[d]}
          </Text>
        ))}
      </View>
      <View style={{ flexDirection: 'row', height: hours * hourH }}>
        {timeW > 0 && (
          <View style={{ width: timeW }}>
            {Array.from({ length: hours }, (_, i) => (planner || i % (style.blockStyle === 'outline' ? 1 : 2) === 0) && (
              <Text key={i} style={{ position: 'absolute', top: i * hourH - (planner ? 0 : 6), fontSize: fs(planner ? 11 : 9), color: style.mutedText, fontWeight: planner ? '700' : '500' }}>
                {formatTime((style.startHour + i) * 60).replace(':00', '')}
              </Text>
            ))}
          </View>
        )}
        {style.days.map((d) => (
          <View key={d} style={{ flex: 1, borderLeftWidth: 1, borderColor: style.gridLine }}>
            {Array.from({ length: hours }, (_, i) => (
              <View key={i} style={{ position: 'absolute', left: 0, right: 0, top: i * hourH, height: hourH, borderTopWidth: style.blockStyle === 'soft' ? 0 : 1, borderColor: style.gridLine, backgroundColor: planner && i % 2 ? 'rgba(0,0,0,0.025)' : undefined }} />
            ))}
            {layoutDay(visible.filter((e) => e.weekday === d)).map(({ event: e, column, columns, overlaps }) => {
              const top = ((Math.max(e.startMin, style.startHour * 60) - style.startHour * 60) / 60) * hourH;
              const height = Math.max(compact ? 6 : 22, ((Math.min(e.endMin, style.endHour * 60) - Math.max(e.startMin, style.startHour * 60)) / 60) * hourH - 2);
              const c = colorFor(e, events, style);
              const look = blockLook(style, c);
              const sel = selectedId === e.id;
              const details = [style.showCode && e.courseCode, style.showRoom && e.location, style.showInstructor && e.organizer].filter(Boolean).join(' · ');
              return (
                <Pressable key={e.id} disabled={!onSelect} onPress={() => onSelect?.(e)}
                  accessibilityRole={onSelect ? 'button' : undefined}
                  accessibilityLabel={`${e.title}, ${DAY_NAMES[e.weekday]} ${formatTime(e.startMin)} to ${formatTime(e.endMin)}${overlaps ? ', overlaps another class' : ''}`}
                  style={{
                    position: 'absolute', top, height, left: `${(column / columns) * 100}%`, width: `${100 / columns}%`,
                    padding: 1,
                  }}>
                  <View style={{ flex: 1, ...look.box, borderColor: overlaps ? '#D93025' : sel ? style.text : look.box.borderColor, borderWidth: sel || overlaps ? 2 : look.box.borderWidth, borderStyle: overlaps ? 'dashed' : 'solid', overflow: 'hidden', padding: compact ? 1 : 3 }}>
                    {!compact && (
                      <>
                        <Text numberOfLines={planner ? 2 : 3} style={{ color: look.text, fontSize: fs(planner ? 11 : 10), fontWeight: style.bold ? '700' : '600' }}>
                          {planner && e.courseCode ? `${e.courseCode} · ` : ''}{e.title}
                        </Text>
                        {!!details && height > 34 && <Text numberOfLines={2} style={{ color: look.muted, fontSize: fs(9) }}>{planner ? details.replace(e.courseCode ? `${e.courseCode} · ` : '', '') : details}</Text>}
                        {planner && style.showNotes && !!e.notes && height > 56 && <Text numberOfLines={2} style={{ color: look.muted, fontSize: fs(9), fontStyle: 'italic' }}>✎ {e.notes}</Text>}
                      </>
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
      {style.blockStyle === 'solid' && !compact && subjects.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
          {subjects.map((e) => (
            <View key={e.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: colorFor(e, events, style) }} />
              <Text style={{ color: style.text, fontSize: fs(10) }}>{e.courseCode ?? e.title}</Text>
            </View>
          ))}
        </View>
      )}
      {planner && !compact && (
        <View style={{ marginTop: 8, borderTopWidth: 1, borderColor: style.gridLine, paddingTop: 6, gap: 2 }}>
          <Text style={{ color: style.mutedText, fontSize: fs(10), fontWeight: '700' }}>NOTES</Text>
          {events.filter((e) => e.notes).length === 0
            ? <Text style={{ color: style.mutedText, fontSize: fs(10) }}>Add notes to a class to see them here.</Text>
            : [...new Map(events.filter((e) => e.notes).map((e) => [e.title, e])).values()].map((e) => (
              <Text key={e.id} style={{ color: style.text, fontSize: fs(10) }}>• {e.courseCode ?? e.title}: {e.notes}</Text>
            ))}
        </View>
      )}
    </View>
  );
}

function blockLook(style: TimetableStyle, c: string) {
  switch (style.blockStyle) {
    case 'outline': return { box: { backgroundColor: style.background, borderColor: c, borderWidth: 1, borderLeftWidth: 3, borderRadius: 2 }, text: style.text, muted: style.mutedText };
    case 'soft': return { box: { backgroundColor: c, borderColor: c, borderWidth: 0, borderRadius: 10 }, text: textOn(c), muted: textOn(c) === '#FFFFFF' ? '#FFFFFFCC' : '#00000099' };
    case 'solid': return { box: { backgroundColor: c, borderColor: c, borderWidth: 0, borderRadius: 6 }, text: textOn(c), muted: textOn(c) === '#FFFFFF' ? '#FFFFFFDD' : '#000000AA' };
    case 'glow': return { box: { backgroundColor: '#2A2225', borderColor: c, borderWidth: 1.5, borderRadius: 8 }, text: c, muted: style.mutedText };
    case 'planner': return { box: { backgroundColor: '#FFFFFF', borderColor: style.gridLine, borderWidth: 1, borderTopWidth: 4, borderTopColor: c, borderRadius: 2 }, text: style.text, muted: style.mutedText };
  }
}
