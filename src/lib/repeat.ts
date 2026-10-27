// How often an event happens, like an alarm: once, every day, every week or every month.
import type { ScheduleEvent, Weekday } from './types';

export type Repeat = 'once' | 'daily' | 'weekly' | 'monthly';
export const REPEAT_LABEL: Record<Repeat, string> = { once: 'One time', daily: 'Every day', weekly: 'Every week', monthly: 'Every month' };

const pad = (n: number) => String(n).padStart(2, '0');
export const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseIso = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };

/** Whether the event happens on this date. Weekly and daily events follow their weekday. */
export function occursOn(e: ScheduleEvent, date: Date): boolean {
  const r = e.repeat ?? 'weekly';
  if (r === 'once') return !!e.date && e.date === isoDate(date);
  if (r === 'monthly') {
    if (!e.date) return false;
    const start = parseIso(e.date);
    if (date < start) return false;
    // A monthly event on the 31st lands on the last day of shorter months.
    const last = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    return date.getDate() === Math.min(start.getDate(), last);
  }
  return e.weekday === date.getDay();
}

/** The Sunday that starts the week containing `ref`. */
export function weekStart(ref = new Date()): Date {
  const d = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  d.setDate(d.getDate() - d.getDay());
  return d;
}

/**
 * The events that happen in the current week, each placed on its weekday.
 * Weekly and daily events always count; one-time and monthly events count
 * only in the week they fall on.
 */
export function thisWeek(events: ScheduleEvent[], ref = new Date()): ScheduleEvent[] {
  const sun = weekStart(ref);
  const days = Array.from({ length: 7 }, (_, i) => new Date(sun.getFullYear(), sun.getMonth(), sun.getDate() + i));
  const out: ScheduleEvent[] = [];
  for (const e of events) {
    const r = e.repeat ?? 'weekly';
    if (r === 'weekly' || r === 'daily') { out.push(e); continue; }
    const day = days.find((d) => occursOn(e, d));
    if (day) out.push({ ...e, weekday: day.getDay() as Weekday });
  }
  return out;
}

/** A short line such as "Every month on the 5th" or "One time · Tue, Oct 28". */
export function repeatLine(e: ScheduleEvent): string | undefined {
  const r = e.repeat ?? 'weekly';
  if (r === 'once' && e.date) return `One time · ${parseIso(e.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}`;
  if (r === 'monthly' && e.date) return `Every month on the ${ordinal(parseIso(e.date).getDate())}`;
  if (r === 'daily') return 'Every day';
  return undefined;
}

const ordinal = (n: number) => n + (n >= 11 && n <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th');
