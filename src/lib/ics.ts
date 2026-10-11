// Builds a standard .ics calendar file that Google, Outlook, and Apple Calendar can import.
import type { ScheduleEvent } from './types';

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
const BYDAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

/** Escapes commas, semicolons, and new lines as the iCalendar format requires. */
function esc(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

/**
 * Weekly events repeat from termStart until termEnd (inclusive).
 * Times are written as local "floating" times so they match the user's phone clock.
 */
export function buildIcs(events: ScheduleEvent[], termStart: Date, termEnd: Date, now = new Date()): string {
  const stamp = `${ymd(now)}T${pad(now.getHours())}${pad(now.getMinutes())}00`;
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ScheduLens//EN', 'CALSCALE:GREGORIAN'];
  for (const e of events) {
    const first = new Date(termStart);
    while (first.getDay() !== e.weekday) first.setDate(first.getDate() + 1);
    const t = (min: number) => `${ymd(first)}T${pad(Math.floor(min / 60))}${pad(min % 60)}00`;
    lines.push(
      'BEGIN:VEVENT',
      `UID:${e.id}@schedulens`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${t(e.startMin)}`,
      `DTEND:${t(e.endMin)}`,
      `RRULE:FREQ=WEEKLY;BYDAY=${BYDAY[e.weekday]};UNTIL=${ymd(termEnd)}T235959`,
      `SUMMARY:${esc(e.title)}`,
    );
    if (e.location) lines.push(`LOCATION:${esc(e.location)}`);
    if (e.organizer) lines.push(`DESCRIPTION:${esc('Instructor: ' + e.organizer)}`);
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}
