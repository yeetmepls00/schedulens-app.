import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseScheduleText, readGrid, type PositionedLine } from '../parser';

const days = (l: string) => parseScheduleText(l).map((e) => e.weekday.value);
const one = (l: string) => parseScheduleText(l)[0];

test('day ranges and day groups from work and personal schedules', () => {
  assert.deepEqual(days('Mon-Fri 9:00 AM - 5:00 PM Office'), [1, 2, 3, 4, 5]);
  assert.deepEqual(days('Monday to Friday 8am-5pm Front desk'), [1, 2, 3, 4, 5]);
  assert.deepEqual(days('Weekdays 9-6 Work'), [1, 2, 3, 4, 5]);
  assert.deepEqual(days('Weekends 10am-2pm Cashier'), [6, 0]);
  assert.equal(days('Daily 6:00-6:30 AM Morning run').length, 7);
  assert.deepEqual(days('Daily standup 9:15-9:30 AM Mon-Fri'), [1, 2, 3, 4, 5]);
  assert.equal(one('Daily standup 9:15-9:30 AM Mon-Fri').title.value, 'Daily standup');
  assert.deepEqual(days('Thursdays 7pm to 9pm Choir practice'), [4]);
  assert.deepEqual(days('MON-WED-FRI 9-10 Gym'), [1, 3, 5]);
});

test('24-hour, noon and night-shift times', () => {
  const e = one('CS 149 TTh 0800-0915 Room 248');
  assert.deepEqual([e.startMin.value, e.endMin.value, e.location.value], [480, 555, 'Room 248']);
  assert.equal(one('Wed 12nn-1pm Lunch break').startMin.value, 720);
  const night = parseScheduleText('Sat 10pm - 6am Night shift');
  assert.deepEqual(night.map((n) => [n.weekday.value, n.startMin.value, n.endMin.value]), [[6, 1320, 1440], [0, 0, 360]]);
  assert.equal(parseScheduleText('School year 2026-2027').length, 0);
});

test('titles stay clean of joiners and places', () => {
  assert.equal(one('Piano lesson Saturday 3-4pm with Ms. Lim').title.value, 'Piano lesson');
  assert.equal(one('Gym every Mon, Wed, Fri 6:00-7:00 PM').title.value, 'Gym');
  const h = one('History 101 TR 2:00-3:15pm Smith Hall 120 Dr. Allen');
  assert.deepEqual([h.title.value, h.location.value, h.organizer.value], ['History 101', 'Smith Hall 120', 'Dr. Allen']);
  const t = one('AT 121b Automotive Electrical Systems Tue 8-12; Thu 8-12 AD-3');
  assert.deepEqual([t.courseCode.value, t.title.value], ['AT 121b', 'Automotive Electrical Systems']);
});

const at = (text: string, left: number, top: number, width = text.length * 12): PositionedLine => ({ text, frame: { left, top, width, height: 26 } });

test('reads a day-by-time grid timetable', () => {
  const ev = readGrid([
    at('Time', 140, 179), at('Monday', 330, 178), at('Tuesday', 520, 178), at('Wednesday', 700, 178),
    at('7:30-9:00', 107, 272), at('MATH 101', 313, 253), at('Rm 204', 335, 294), at('MATH 101', 711, 253), at('Rm 204', 733, 294),
    at('9:00-10:30', 96, 387), at('ENG 102', 515, 367), at('Rm 110', 527, 409),
  ])!;
  assert.deepEqual(ev.map((e) => [e.weekday.value, e.startMin.value, e.endMin.value, e.title.value, e.location.value]), [
    [1, 450, 540, 'MATH 101', 'Room 204'],
    [2, 540, 630, 'ENG 102', 'Room 110'],
    [3, 450, 540, 'MATH 101', 'Room 204'],
  ]);
});

test('reads a staff roster and skips days off', () => {
  const ev = readGrid([
    at('Employee', 94, 182), at('Mon', 320, 182), at('Tue', 470, 182), at('Wed', 650, 182),
    at('Ana Reyes', 89, 263), at('9-5', 318, 263), at('OFF', 470, 263), at('1pm-9pm', 640, 263),
    at('Ben Cruz', 105, 343), at('OFF', 318, 343), at('7am-3pm', 460, 343), at('7am-3pm', 640, 343),
  ])!;
  assert.deepEqual(ev.map((e) => [e.title.value, e.weekday.value, e.startMin.value, e.endMin.value]), [
    ['Ana Reyes', 1, 540, 1020], ['Ben Cruz', 2, 420, 900], ['Ana Reyes', 3, 780, 1260], ['Ben Cruz', 3, 420, 900],
  ]);
});
