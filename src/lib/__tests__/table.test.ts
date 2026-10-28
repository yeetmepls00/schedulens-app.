import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readTable, type PositionedLine } from '../parser';

const at = (text: string, left: number, top: number, width = text.length * 9): PositionedLine => ({ text, frame: { left, top, width, height: 18 } });

test('reads a registration form by column, giving each second time line to its class', () => {
  const lines = [
    at('ITIA 120', 340, 954), at('Information Assurance and Security 1', 510, 954), at('BSIT 3', 1060, 956),
    at('01:00 PM - 03:40 PM', 1160, 942), at('COLLEGE COMLAB', 1365, 942), at('Fri', 1600, 940), at('ARMILDEZ MARIA', 1823, 937),
    at('03:40 PM - 07:00 PM', 1160, 970), at('COLLEGE COMLAB', 1365, 969), at('Fri', 1600, 968), at('RIZZA L.', 1823, 966),
    at('ITSA 122', 345, 1084), at('Systems Administration and Maintenance', 512, 1083), at('BSIT 3', 1066, 1085),
    at('08:00 AM - 10:40 AM', 1163, 1071), at('COLLEGE COMLAB', 1369, 1070), at('Tue', 1602, 1069),
    at('08:00 AM - 12:00 PM', 1166, 1098), at('COLLEGE COMLAB', 1370, 1097), at('Moa', 1599, 1096), at('GAYUTIN RONILO B.', 1830, 1080),
  ];
  const ev = readTable(lines)!;
  assert.equal(ev.length, 4);
  assert.deepEqual(ev.map((e) => [e.courseCode.value, e.title.value, e.weekday.value, e.startMin.value, e.location.value]), [
    ['ITIA 120', 'Information Assurance and Security 1', 5, 780, 'College Comlab'],
    ['ITIA 120', 'Information Assurance and Security 1', 5, 940, 'College Comlab'],
    ['ITSA 122', 'Systems Administration and Maintenance', 2, 480, 'College Comlab'],
    ['ITSA 122', 'Systems Administration and Maintenance', 1, 480, 'College Comlab'],
  ]);
  assert.equal(ev[0].organizer.value, 'ARMILDEZ MARIA RIZZA L.');
  assert.equal(ev[3].weekday.confidence, 'low');
});

import { parseScheduleText } from '../parser';

test('reads short day forms in any case', () => {
  const cases: [string, number[]][] = [['MON', [1]], ['mon', [1]], ['M', [1]], ['m', [1]], ['th', [4]], ['TTh', [2, 4]], ['mwf', [1, 3, 5]], ['M/W', [1, 3]], ['T TH', [2, 4]], ['Sa', [6]], ['su', [0]]];
  for (const [form, days] of cases) {
    const ev = parseScheduleText(`IT 101 Programming ${form} 9:00-10:00 AM`);
    assert.deepEqual(ev.map((e) => e.weekday.value), days, form);
    assert.equal(ev[0].title.value, 'Programming', form);
  }
});

test('keeps an instructor that the schedule names', () => {
  const org = (l: string) => parseScheduleText(l)[0].organizer.value;
  assert.equal(org('IT 101 Programming MWF 9:00-10:00 AM Instructor: Juan Dela Cruz'), 'Juan Dela Cruz');
  assert.equal(org('Math 1 TTh 1:00-2:30 PM Teacher: maria santos'), 'maria santos');
  assert.equal(org('HCI II MW 10:00-12:00 PM Room 204 Ms. De Juan'), 'Ms. De Juan');
  assert.equal(org('IT 101 Programming MWF 9:00-10:00 AM Rm 204 Professor DELA CRUZ, JUAN M.'), 'DELA CRUZ, JUAN M.');
});
