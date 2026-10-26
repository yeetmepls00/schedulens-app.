// Finds the closest upcoming event after a given day and time.
import { DAY_NAMES } from './time';
import type { ScheduleEvent, Weekday } from './types';

/** Closest event starting at or after `fromMin` on `fromDay`, looking up to a week ahead. */
export function nextEvent(events: ScheduleEvent[], fromDay: Weekday, fromMin = 0): { event: ScheduleEvent; daysAhead: number } | null {
  for (let i = 0; i < 8; i++) {
    const d = ((fromDay + i) % 7) as Weekday;
    const found = events.filter((e) => e.weekday === d && (i > 0 || e.startMin >= fromMin)).sort((a, b) => a.startMin - b.startMin)[0];
    if (found) return { event: found, daysAhead: i };
  }
  return null;
}

/** "Later today", "Tomorrow", or the weekday name, counted from today. */
export function whenLabel(daysAhead: number, day: Weekday) {
  return daysAhead === 0 ? 'Later today' : daysAhead === 1 ? 'Tomorrow' : DAY_NAMES[day];
}
