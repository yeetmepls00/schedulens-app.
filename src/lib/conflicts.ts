// Finds overlapping events, short travel gaps, and long stretches without a break.
// These are simple rules on the saved schedule. They do not use traffic, weather,
// or health data (see the thesis limitations).
import type { ScheduleEvent, ScheduleIssue, Weekday } from './types';
import { DAY_NAMES, formatDuration, formatTime } from './time';

export interface IssueRules {
  /** Minimum minutes needed to move between two different places. */
  minTravelMin: number;
  /** A gap shorter than this does not count as a break. */
  minBreakMin: number;
  /** Warn when activity runs this long without a break (thesis: 4 hours). */
  maxContinuousMin: number;
}

export const DEFAULT_RULES: IssueRules = { minTravelMin: 15, minBreakMin: 15, maxContinuousMin: 240 };

const norm = (s?: string) => (s ?? '').toLowerCase().replace(/\s+/g, ' ').trim();

export function findIssues(events: ScheduleEvent[], rules: IssueRules = DEFAULT_RULES): ScheduleIssue[] {
  const issues: ScheduleIssue[] = [];
  for (let day = 0 as Weekday; day <= 6; day = (day + 1) as Weekday) {
    const list = events.filter((e) => e.weekday === day).sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
    if (list.length === 0) continue;

    // 1. Overlaps: any two events that share time.
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length && list[j].startMin < list[i].endMin; j++) {
        const a = list[i];
        const b = list[j];
        const from = Math.max(a.startMin, b.startMin);
        const to = Math.min(a.endMin, b.endMin);
        issues.push({
          kind: 'overlap',
          weekday: day,
          eventIds: [a.id, b.id],
          message: `${a.title} overlaps ${b.title}, ${formatTime(from)}–${formatTime(to)}.`,
        });
      }
    }

    // 2. Travel: back-to-back events in different places with too little time between.
    // Compare each event with whichever earlier event ends last (the one you are leaving).
    let prev = list[0];
    for (const b of list.slice(1)) {
      const a = prev;
      if (b.endMin > prev.endMin) prev = b;
      const gap = b.startMin - a.endMin;
      if (gap < 0 || gap >= rules.minTravelMin) continue;
      if (!a.location || !b.location || norm(a.location) === norm(b.location)) continue;
      issues.push({
        kind: 'travel',
        weekday: day,
        eventIds: [a.id, b.id],
        message: `Only ${gap} min to get from ${a.location} to ${b.location}.`,
      });
    }

    // 3. Workload: chains of events whose gaps are all shorter than a real break.
    let chain = [list[0]];
    let chainEnd = list[0].endMin;
    const flush = () => {
      const total = chainEnd - chain[0].startMin;
      if (total >= rules.maxContinuousMin) {
        issues.push({
          kind: 'workload',
          weekday: day,
          eventIds: chain.map((e) => e.id),
          message: `${formatDuration(total)} of back-to-back activities on ${DAY_NAMES[day]}, ${formatTime(chain[0].startMin)}–${formatTime(chainEnd)}. Consider adding a break.`,
        });
      }
    };
    for (const e of list.slice(1)) {
      if (e.startMin - chainEnd < rules.minBreakMin) {
        chain.push(e);
        chainEnd = Math.max(chainEnd, e.endMin);
      } else {
        flush();
        chain = [e];
        chainEnd = e.endMin;
      }
    }
    flush();
  }
  return issues;
}
