// Helpers for reading and writing times and days.
import type { Weekday } from './types';

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
export const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/** 630 -> "10:30 AM" */
export function formatTime(min: number): string {
  const h24 = Math.floor(min / 60) % 24;
  const m = min % 60;
  const suffix = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

/** 135 -> "2 h 15 min" */
export function formatDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

export interface ParsedTime {
  minutes: number;
  /** True when AM/PM was written; false when we had to guess. */
  explicitMeridiem: boolean;
}

/**
 * Reads one time like "10:00 AM", "10am", "1:30PM", "13:30", "0730H".
 * Returns undefined if the text is not a time.
 */
export function parseTime(raw: string): ParsedTime | undefined {
  let s = raw.trim().toLowerCase().replace(/\s+/g, '').replace(/\./g, '').replace(/hrs$/, 'h');
  // "noon", "12nn" (Philippine noon), "midnight", "12mn"
  if (s === 'noon') s = '12pm';
  if (s === 'midnight') s = '12am';
  s = s.replace(/(?:nn|noon)$/, 'pm').replace(/mn$/, 'am');
  const m = s.match(/^(\d{1,2})(?::?(\d{2}))?(am|pm|a|p|h)?$/);
  if (!m) return undefined;
  let h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  const mer = m[3];
  if (min > 59 || h > 24) return undefined;
  if (mer === 'am' || mer === 'a') {
    if (h === 12) h = 0;
  } else if (mer === 'pm' || mer === 'p') {
    if (h < 12) h += 12;
  }
  const explicit = mer !== undefined || h >= 13 || h === 0;
  return { minutes: h * 60 + min, explicitMeridiem: explicit };
}

/**
 * When AM/PM is missing, school schedules usually run 7 AM to 9 PM.
 * Hours 1 to 6 are treated as PM (1:00 -> 1:00 PM).
 */
export function guessDaytime(min: number): number {
  const h = Math.floor(min / 60);
  return h >= 1 && h <= 6 ? min + 12 * 60 : min;
}

/** Day words and codes used on Philippine and US class schedules. */
const DAY_TOKENS: Record<string, Weekday[]> = {
  sunday: [0], sun: [0], su: [0],
  monday: [1], mon: [1], m: [1],
  tuesday: [2], tues: [2], tue: [2], t: [2], tu: [2],
  wednesday: [3], wed: [3], w: [3],
  thursday: [4], thurs: [4], thu: [4], th: [4], r: [4],
  friday: [5], fri: [5], f: [5],
  saturday: [6], sat: [6], s: [6], sa: [6],
};

/**
 * Reads day text such as "Mon", "MWF", "TTh", "M/W", "Tue & Thu".
 * Returns the weekdays and whether the match was unambiguous.
 */
export function parseDays(raw: string): { days: Weekday[]; strong: boolean } | undefined {
  const s = raw.trim().toLowerCase().replace(/[.,]/g, ' ');
  // Full or short words separated by spaces, slashes, dashes, or "&"
  const parts = s.split(/[\s/&-]+|and/).filter(Boolean);
  if (parts.length > 1 && parts.every((p) => DAY_TOKENS[p] && p.length >= 2)) {
    return { days: dedupe(parts.flatMap((p) => DAY_TOKENS[p])), strong: true };
  }
  if (parts.length === 1 && DAY_TOKENS[parts[0]] && parts[0].length >= 3) {
    return { days: DAY_TOKENS[parts[0]], strong: true };
  }
  // Packed codes like "mwf", "tth", "th", "mw"
  const packed = s.replace(/\s+/g, '');
  if (/^(m|tu|th|t|w|f|sa|su|s|r)+$/.test(packed)) {
    const days: Weekday[] = [];
    let i = 0;
    while (i < packed.length) {
      const two = packed.slice(i, i + 2);
      if (two === 'th' || two === 'tu' || two === 'sa' || two === 'su') {
        days.push(DAY_TOKENS[two][0]);
        i += 2;
      } else {
        days.push(DAY_TOKENS[packed[i]][0]);
        i += 1;
      }
    }
    // A lone "s" or "t" is easy to misread, so mark single letters as weak.
    return { days: dedupe(days), strong: packed.length > 1 };
  }
  return undefined;
}

function dedupe(days: Weekday[]): Weekday[] {
  return [...new Set(days)].sort() as Weekday[];
}
