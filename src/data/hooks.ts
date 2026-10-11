import { useMemo } from 'react';
import { findIssues } from '../lib/conflicts';
import type { ScheduleIssue } from '../lib/types';
import { getRules, useEvents } from './db';

/** All events plus the warnings found in them, recalculated whenever events change. */
export function useSchedule() {
  const events = useEvents();
  const issues = useMemo(() => findIssues(events, getRules()), [events]);
  const issueFor = (id: string): ScheduleIssue | undefined =>
    issues.find((i) => i.kind === 'overlap' && i.eventIds.includes(id)) ?? issues.find((i) => i.eventIds.includes(id));
  return { events, issues, issueFor };
}
