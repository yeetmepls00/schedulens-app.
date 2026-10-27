import { useMemo } from 'react';
import { findIssues } from '../lib/conflicts';
import type { ScheduleIssue } from '../lib/types';
import { thisWeek } from '../lib/repeat';
import { getAlerts, getRules, useEvents } from './db';

/**
 * This week's events (one-time and monthly ones only in the week they fall on),
 * every saved event as `all`, and the warnings, recalculated whenever events change.
 */
export function useSchedule() {
  const all = useEvents();
  const events = useMemo(() => thisWeek(all), [all]);
  const on = getAlerts();
  const issues = findIssues(events, getRules()).filter((i) => on[i.kind]);
  const issueFor = (id: string): ScheduleIssue | undefined =>
    issues.find((i) => i.kind === 'overlap' && i.eventIds.includes(id)) ?? issues.find((i) => i.eventIds.includes(id));
  return { events, all, issues, issueFor };
}
