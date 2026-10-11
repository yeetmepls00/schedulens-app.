// Finds times when group members are free.
//
// Privacy: this only ever receives BusyBlock values (day + start + end).
// Titles, rooms, and instructors never reach this code or other members.
import type { BusyBlock, FreeSlot, ScheduleEvent, Weekday } from './types';

/** Strips everything private from a member's events before sharing. */
export function toBusyBlocks(events: ScheduleEvent[]): BusyBlock[] {
  return events.map(({ weekday, startMin, endMin }) => ({ weekday, startMin, endMin }));
}

export interface FreeTimeOptions {
  /** Only look inside these hours (default 7:00 AM to 9:00 PM). */
  dayStartMin?: number;
  dayEndMin?: number;
  /** Ignore free gaps shorter than this. */
  minLengthMin?: number;
  /** Also return slots where at least this many members are free. Default: everyone. */
  minFree?: number;
}

/**
 * members[i] holds the busy blocks of member i.
 * Returns free slots on the given day, longest-agreement first.
 */
export function findFreeSlots(members: BusyBlock[][], weekday: Weekday, opts: FreeTimeOptions = {}): FreeSlot[] {
  const dayStart = opts.dayStartMin ?? 7 * 60;
  const dayEnd = opts.dayEndMin ?? 21 * 60;
  const minLen = opts.minLengthMin ?? 30;
  const total = members.length;
  const need = opts.minFree ?? total;
  if (total === 0) return [];

  // Every start/end time is a point where someone's status may change.
  const points = new Set<number>([dayStart, dayEnd]);
  for (const m of members) for (const b of m) {
    if (b.weekday !== weekday) continue;
    if (b.startMin > dayStart && b.startMin < dayEnd) points.add(b.startMin);
    if (b.endMin > dayStart && b.endMin < dayEnd) points.add(b.endMin);
  }
  const sorted = [...points].sort((a, b) => a - b);

  const slots: FreeSlot[] = [];
  for (let i = 0; i + 1 < sorted.length; i++) {
    const from = sorted[i];
    const to = sorted[i + 1];
    const freeCount = members.filter(
      (m) => !m.some((b) => b.weekday === weekday && b.startMin < to && b.endMin > from),
    ).length;
    const last = slots[slots.length - 1];
    if (last && last.endMin === from && last.freeCount === freeCount) last.endMin = to;
    else slots.push({ weekday, startMin: from, endMin: to, freeCount, totalMembers: total });
  }
  return slots
    .filter((s) => s.freeCount >= need && s.endMin - s.startMin >= minLen)
    .sort((a, b) => b.freeCount - a.freeCount || a.startMin - b.startMin);
}
