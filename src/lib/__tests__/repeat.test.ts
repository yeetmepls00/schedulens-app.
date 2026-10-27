import { test } from 'node:test';
import assert from 'node:assert/strict';
import { occursOn, repeatLine, thisWeek } from '../repeat';
import type { ScheduleEvent } from '../types';

const base: ScheduleEvent = { id: 'a', title: 'X', weekday: 1, startMin: 540, endMin: 600 };
const wed = new Date(2026, 9, 28); // Wednesday, Oct 28 2026

test('one-time events show only on their date and week', () => {
  const e = { ...base, repeat: 'once' as const, date: '2026-10-30' };
  assert.equal(occursOn(e, new Date(2026, 9, 30)), true);
  assert.equal(occursOn(e, new Date(2026, 10, 6)), false);
  assert.deepEqual(thisWeek([e], wed).map((x) => x.weekday), [5]);
  assert.deepEqual(thisWeek([e], new Date(2026, 10, 4)), []);
});

test('monthly events land on the same day each month, last day when shorter', () => {
  const e = { ...base, repeat: 'monthly' as const, date: '2026-01-31' };
  assert.equal(occursOn(e, new Date(2026, 1, 28)), true);
  assert.equal(occursOn(e, new Date(2026, 2, 31)), true);
  assert.equal(occursOn(e, new Date(2025, 11, 31)), false);
  assert.equal(repeatLine(e), 'Every month on the 31st');
});

test('weekly events always count', () => {
  assert.deepEqual(thisWeek([base], wed), [base]);
});
