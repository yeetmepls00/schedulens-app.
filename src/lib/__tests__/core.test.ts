import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDays, parseTime, formatTime } from '../time';
import { parseScheduleText, groupIntoRows, countNeedsReview } from '../parser';
import { findIssues } from '../conflicts';
import { findFreeSlots, toBusyBlocks } from '../freeTime';
import { buildIcs } from '../ics';
import { checkScheduleFile } from '../fileCheck';
import type { ScheduleEvent } from '../types';

test('reads common time formats', () => {
  assert.equal(parseTime('10:00 AM')?.minutes, 600);
  assert.equal(parseTime('1:30PM')?.minutes, 810);
  assert.equal(parseTime('12:00 pm')?.minutes, 720);
  assert.equal(parseTime('12am')?.minutes, 0);
  assert.equal(parseTime('13:15')?.minutes, 795);
  assert.equal(parseTime('hello'), undefined);
  assert.equal(formatTime(810), '1:30 PM');
});

test('reads day codes', () => {
  assert.deepEqual(parseDays('MWF')?.days, [1, 3, 5]);
  assert.deepEqual(parseDays('TTh')?.days, [2, 4]);
  assert.deepEqual(parseDays('Tue & Thu')?.days, [2, 4]);
  assert.deepEqual(parseDays('Saturday')?.days, [6]);
  assert.equal(parseDays('M')?.strong, false);
});

test('parses a typical class schedule row into one event per day', () => {
  const ev = parseScheduleText('HCI II  MW  10:00-12:00 PM  Room 204  Prof. Jhunna De Juan');
  assert.equal(ev.length, 2);
  assert.equal(ev[0].title.value, 'HCI II');
  assert.deepEqual(ev.map((e) => e.weekday.value), [1, 3]);
  assert.equal(ev[0].startMin.value, 600);
  assert.equal(ev[0].endMin.value, 720);
  assert.equal(ev[0].startMin.confidence, 'high');
  assert.equal(ev[0].location.value, 'Room 204');
  assert.equal(ev[0].organizer.value, 'Prof. Jhunna De Juan');
  assert.equal(countNeedsReview(ev[0]), 0);
});

test('marks guessed values as low confidence and missing values as missing', () => {
  const [e] = parseScheduleText('Data Structures Lab  1:00-3:00');
  assert.equal(e.startMin.value, 780); // 1:00 guessed as PM
  assert.equal(e.startMin.confidence, 'low');
  assert.equal(e.weekday.confidence, 'missing');
  assert.equal(e.location.confidence, 'missing');
  assert.ok(countNeedsReview(e) >= 3);
});

test('uses a day heading for the classes under it', () => {
  const ev = parseScheduleText(['MONDAY', 'IT Ethics 9:00 AM - 11:00 AM Rm 108', 'PE 2 1:00 PM - 3:00 PM Gym']);
  assert.equal(ev.length, 2);
  assert.ok(ev.every((e) => e.weekday.value === 1));
  assert.equal(ev[0].location.value, 'Room 108');
});

test('joins table cells that sit on the same row', () => {
  const rows = groupIntoRows([
    { text: '10:00-12:00 PM', frame: { top: 100, left: 200, width: 80, height: 12 } },
    { text: 'HCI II', frame: { top: 102, left: 10, width: 60, height: 12 } },
    { text: 'TTh', frame: { top: 101, left: 120, width: 30, height: 12 } },
    { text: 'PE 2', frame: { top: 140, left: 10, width: 40, height: 12 } },
  ]);
  assert.equal(rows[0], 'HCI II  TTh  10:00-12:00 PM');
  assert.equal(rows[1], 'PE 2');
});

const ev = (id: string, weekday: 1, s: number, e: number, location?: string): ScheduleEvent => ({ id, title: id, weekday, startMin: s, endMin: e, location });

test('finds overlaps, short travel, and long continuous activity', () => {
  const issues = findIssues([
    ev('HCI', 1, 600, 720, 'Room 204'),
    ev('Org', 1, 630, 690, 'Student Center'),
    ev('Lab', 1, 725, 840, 'Gym'),
    ev('Ethics', 1, 845, 900, 'Gym'),
  ]);
  const kinds = issues.map((i) => i.kind).sort();
  assert.deepEqual(kinds, ['overlap', 'travel', 'workload']);
  const travel = issues.find((i) => i.kind === 'travel')!;
  assert.match(travel.message, /Only 5 min/);
  const work = issues.find((i) => i.kind === 'workload')!;
  assert.match(work.message, /5 h/);
});

test('no workload warning when there is a real break', () => {
  const issues = findIssues([ev('A', 1, 480, 660), ev('B', 1, 690, 840)]);
  assert.equal(issues.filter((i) => i.kind === 'workload').length, 0);
});

test('finds common free time without seeing titles', () => {
  const a = toBusyBlocks([ev('secret A', 1, 480, 840)]);
  const b = toBusyBlocks([ev('secret B', 1, 600, 720), ev('B2', 1, 960, 1020)]);
  assert.ok(!JSON.stringify(a).includes('secret'));
  const slots = findFreeSlots([a, b], 1);
  assert.deepEqual(slots.map((s) => [s.startMin, s.endMin]), [[420, 480], [840, 960], [1020, 1260]]);
  const partial = findFreeSlots([a, b], 1, { minFree: 1 });
  assert.ok(partial.some((s) => s.freeCount === 1));
});

test('exports a weekly .ics file', () => {
  const ics = buildIcs([ev('HCI, II', 1, 600, 720, 'Room 204')], new Date(2026, 9, 7), new Date(2026, 11, 18), new Date(2026, 9, 1));
  assert.match(ics, /DTSTART:20261012T100000/); // first Monday on or after Oct 7
  assert.match(ics, /RRULE:FREQ=WEEKLY;BYDAY=MO;UNTIL=20261218T235959/);
  assert.match(ics, /SUMMARY:HCI\\, II/);
});

test('joins table cells that wrap onto two lines (PDF and OCR layouts)', () => {
  const rows = groupIntoRows([
    { text: 'HCI 2 Human Computer', frame: { top: 100, left: 28, width: 145, height: 13 } },
    { text: 'Interaction', frame: { top: 115, left: 28, width: 63, height: 13 } },
    { text: 'TTh', frame: { top: 107, left: 249, width: 24, height: 13 } },
    { text: '10:30 AM-12:00', frame: { top: 100, left: 294, width: 95, height: 13 } },
    { text: 'PM', frame: { top: 115, left: 294, width: 20, height: 13 } },
    { text: 'GE 5', frame: { top: 160, left: 28, width: 40, height: 13 } },
  ]);
  assert.equal(rows[0], 'HCI 2 Human Computer  Interaction  TTh  10:30 AM-12:00  PM');
  assert.equal(rows[1], 'GE 5');
  const [e] = parseScheduleText(rows[0]);
  assert.equal(e.title.value, 'HCI 2 Human Computer Interaction');
  assert.equal(e.startMin.value, 630);
  assert.equal(e.endMin.value, 720);
});

test('ignores table borders and flags misread day codes for review', () => {
  const ev = parseScheduleText('IT 311 Data Structures | MWEF | 8:00-9:00 AM | Room 204 | Prof. Reyes');
  assert.deepEqual(ev.map((e) => e.weekday.value), [1, 3, 5]);
  assert.equal(ev[0].weekday.confidence, 'low');
  assert.equal(ev[0].title.value, 'IT 311 Data Structures');
  assert.equal(ev[0].location.value, 'Room 204');
  assert.equal(ev[0].organizer.value, 'Prof. Reyes');
});

test('checks schedule files before reading them', () => {
  assert.deepEqual(checkScheduleFile('sched.PNG', 'image/png', 1000), { kind: 'image' });
  assert.deepEqual(checkScheduleFile('sched.jpeg', undefined, 1000), { kind: 'image' });
  assert.deepEqual(checkScheduleFile('sched.pdf', 'application/pdf', 1000), { kind: 'pdf' });
  assert.ok('error' in checkScheduleFile('notes.txt', 'text/plain', 10));
  assert.ok('error' in checkScheduleFile('IMG_1.HEIC', 'image/heic', 10));
  assert.ok('error' in checkScheduleFile('big.png', 'image/png', 11 * 1024 * 1024));
  assert.ok('error' in checkScheduleFile('empty.pdf', 'application/pdf', 0));
});
