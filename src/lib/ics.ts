// Builds a standard .ics calendar file that Google, Outlook, and Apple Calendar can import.
import type { ScheduleEvent } from './types';

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
const BYDAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

/** Escapes commas, semicolons, and new lines as the iCalendar format requires. */
function esc(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

/**
 * Weekly events repeat from termStart until termEnd (inclusive).
 * Times are written as local "floating" times so they match the user's phone clock.
 */
export function buildIcs(events: ScheduleEvent[], termStart: Date, termEnd: Date, now = new Date(), timeZone = localTimeZone()): string {
  const stamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}00Z`;
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ScheduLens//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:ScheduLens classes'];
  // Times are "floating" (no zone); this tells Google and Apple Calendar which zone they mean.
  if (timeZone) lines.push(`X-WR-TIMEZONE:${timeZone}`);
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
      `SUMMARY:${esc(e.courseCode ? `${e.courseCode} ${e.title}` : e.title)}`,
    );
    if (e.location) lines.push(`LOCATION:${esc(e.location)}`);
    const about = [e.organizer && `Instructor: ${e.organizer}`, e.notes && `Notes: ${e.notes}`].filter(Boolean).join('\n');
    if (about) lines.push(`DESCRIPTION:${esc(about)}`);
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}

/** Long lines must be split at 75 characters, continuing with a space (RFC 5545). */
function fold(line: string): string {
  if (line.length <= 75) return line;
  const parts = [line.slice(0, 75)];
  for (let i = 75; i < line.length; i += 74) parts.push(' ' + line.slice(i, i + 74));
  return parts.join('\r\n');
}

function localTimeZone(): string | undefined {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return undefined; }
}
