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
