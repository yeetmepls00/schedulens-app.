// Turns OCR text into editable events.
//
// OCR only gives us words and their positions. This file guesses which words
// are the title, day, time, room, and instructor. Every guess gets a
// confidence so the Verify screen can highlight what the user should check.
import type { Confidence, ExtractedEvent, ExtractedField, Weekday } from './types';
import { guessDaytime, parseDays, parseTime } from './time';

/** A line of text with its position on the page (from ML Kit). */
export interface PositionedLine {
  text: string;
  frame?: { top: number; left: number; width: number; height: number };
}

/**
 * Table schedules come back from OCR (or a PDF) as separate cells. This joins
 * cells that sit on the same table row, left to right, so each row reads as
 * one line. Cells that wrap onto two lines ("Human Computer / Interaction")
 * still join their row, because their lines overlap the row's other cells
 * vertically.
 */
export function groupIntoRows(lines: PositionedLine[]): string[] {
  const withFrames = lines.filter((l) => l.frame);
  if (withFrames.length < lines.length / 2) return lines.map((l) => l.text);
  const items = [...withFrames].sort((a, b) => a.frame!.top - b.frame!.top);
  // Union-find: two lines are in the same row when they overlap vertically by
  // at least 30% of the smaller line's height.
  const parent = items.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < items.length; i++) {
    const a = items[i].frame!;
    for (let j = i + 1; j < items.length; j++) {
      const b = items[j].frame!;
      if (b.top > a.top + a.height) break;
      const overlap = Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top);
      if (overlap >= 0.3 * Math.min(a.height, b.height)) parent[find(j)] = find(i);
    }
  }
  const groups = new Map<number, PositionedLine[]>();
  items.forEach((l, i) => { const r = find(i); groups.set(r, [...(groups.get(r) ?? []), l]); });
  const sameColumn = (a: PositionedLine, b: PositionedLine) =>
    Math.min(a.frame!.left + a.frame!.width, b.frame!.left + b.frame!.width) - Math.max(a.frame!.left, b.frame!.left) > 0;
  return [...groups.values()]
    .sort((a, b) => Math.min(...a.map((l) => l.frame!.top)) - Math.min(...b.map((l) => l.frame!.top)))
    .map((r) =>
      r
        .sort((a, b) => (sameColumn(a, b) ? a.frame!.top - b.frame!.top : a.frame!.left - b.frame!.left))
        .map((l) => l.text)
        .join('  '),
    );
}

const T = String.raw`\d{1,2}(?:[:.]\d{2})?\s*(?:a\.?m\.?|p\.?m\.?|am|pm|a|p|h)?`;
const RANGE = new RegExp(String.raw`(${T})\s*(?:-|–|—|to)\s*(${T})`, 'i');
const ROOM = /\b(?:room|rm\.?|lab|bldg\.?|building)\s*[#:.]?\s*[A-Z0-9][A-Z0-9-]*\b(?:\s*,?\s*(?:bldg\.?|building)\s*[A-Z0-9]+)?/i;
// Short room labels printed on registration forms: "CL 2", "CR-5", "Gym", "AVR".
const ROOM_SHORT = /\b(?:(?:CL|CR|LR|SL|ML|RM)\s?-?\d{1,3}[A-Z]?|GYM|AVR|FIELD|COURT|LIBRARY|TBA)\b/i;
// "IT311", "IT 311", "GE-ELEC 2", "CS 101L"
const COURSE_CODE = /^(?:\d{3,6}\s+)?([A-Z]{2,5}(?:-[A-Z]{2,5})?)\s?-?(\d{1,4}[A-Z]?)\s+(.{3,})$/;
// Named rooms printed in full ("COLLEGE COMLAB"), including common OCR misreads of it.
const ROOM_NAMED = /\bC[A-Za-z0-9]{3,7}\s+C[O0][MN][A-Za-z]{2,4}\b|\b[A-Z]*(?:COMLAB|LAB(?:ORATORY)?|HALL|AUDITORIUM)\b/;
function tidyRoom(raw: string) {
  const r = raw.toUpperCase();
  if (/COM\w*$/.test(r) && /^C/.test(r) && /\s/.test(r)) return 'College Comlab';
  return r.charAt(0) + r.slice(1).toLowerCase();
}
function merge(list: { days: Weekday[]; strong: boolean }[]) {
  return { days: [...new Set(list.flatMap((d) => d.days))], strong: list.every((d) => d.strong) };
}
const ORGANIZER = /\b(?:[Pp]rof(?:essor)?|PROF(?:ESSOR)?|[Dd]r|DR|[Mm]rs?|MRS?|[Mm]s|MS|[Ee]ngr|ENGR|[Ss]ir|SIR|[Mm]a'?am|MA'?AM|[Aa]tty|ATTY|[Tt]chr|TCHR)\.?\s+[A-Z][\w.'-]*(?:,?\s+[A-Z][\w.'-]*){0,3}/;
// "Instructor: Juan Dela Cruz", "Prof - DELA CRUZ, JUAN M.", "Teacher Ana Reyes", "Faculty: santos"
const ORGANIZER_LABEL = /\b(?:instructors?|instr\.?|teachers?|faculty|professors?|lecturers?|advis[eo]rs?|organizers?|facilitators?|speakers?|handled by|taught by)\s*[:\-–]?\s+([A-Za-z][\w.'-]*(?:,?\s+[A-Za-z][\w.'-]*){0,4})/i;

function field<T>(value: T | undefined, confidence: Confidence): ExtractedField<T> {
  return value === undefined ? { value: undefined, confidence: 'missing' } : { value, confidence };
}

function readRange(text: string) {
  const m = text.match(RANGE);
  if (!m) return undefined;
  const a = parseTime(m[1]);
  const b = parseTime(m[2]);
  if (!a || !b) return undefined;
  let start = a.minutes;
  let end = b.minutes;
  let sure = a.explicitMeridiem && b.explicitMeridiem;
  if (!a.explicitMeridiem && b.explicitMeridiem) {
    // "10:00-12:00 PM" or "11-1PM": copy the end's half of the day when it fits.
    const sameHalf = b.minutes >= 12 * 60 ? start + 12 * 60 : start;
    start = sameHalf < end && sameHalf % (24 * 60) === sameHalf ? sameHalf : start;
    if (start >= end && start - 12 * 60 >= 0) start -= 12 * 60;
    sure = true;
  } else if (!a.explicitMeridiem || !b.explicitMeridiem) {
    start = guessDaytime(start);
    end = guessDaytime(end);
    if (end <= start) end += 12 * 60;
  }
  if (end <= start || end > 24 * 60) return undefined;
  return { start, end, sure, span: m[0] };
}

type DayHit = { days: Weekday[]; strong: boolean; span: string; without: string };

const DAY_NAMES_RE = /^(?:mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:r(?:s(?:day)?)?)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)$/i;
const NAME_DAY: Record<string, Weekday> = { mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6, sun: 0 };
const CODE_DAY: Record<string, Weekday> = { m: 1, t: 2, w: 3, th: 4, r: 4, f: 5, s: 6, sa: 6, su: 0 };

/** Packed codes in one consistent case: "MWF", "TTh", "TTH", "mwf", "tth", "M", "m". */
function readCode(tok: string): { days: Weekday[]; strong: boolean } | undefined {
  const upper = /^(?:TH|SU|SA|[MTWRFS])+$/.test(tok) || /^(?:Th|Su|Sa|[MTWRFS])+$/.test(tok);
  const lower = /^(?:th|su|sa|[mtwrfs])+$/.test(tok);
  // OCR sometimes lowers the second letter ("Mw").
  const mixed = !upper && !lower && /^[MTWRFS](?:th|su|sa|[mtwrfs])+$/.test(tok);
  if (!upper && !lower && !mixed) return undefined;
  const days: Weekday[] = [];
  const t = tok.toLowerCase();
  for (let i = 0; i < t.length; ) {
    const two = t.slice(i, i + 2);
    if (CODE_DAY[two] !== undefined && two.length === 2) { days.push(CODE_DAY[two]); i += 2; } else { days.push(CODE_DAY[t[i]]); i += 1; }
  }
  return { days: [...new Set(days)], strong: upper };
}

function readDayToken(tok: string): { days: Weekday[]; strong: boolean } | undefined {
  const clean = tok.replace(/\.$/, '');
  if (DAY_NAMES_RE.test(clean)) return { days: [NAME_DAY[clean.slice(0, 3).toLowerCase()]], strong: true };
  return readCode(clean);
}

/**
 * Finds the days in a line: names ("Monday", "MON", "mon"), short forms ("Tues", "Thurs")
 * and codes ("MWF", "TTh", "M", "m", "mwf"), alone or joined by spaces, "/", "-", "," or "&"
 * ("M/W", "T TH", "Mon-Wed-Fri"). All-lowercase single letters are marked for review.
 */
function readDays(text: string): DayHit | undefined {
  const words = [...text.matchAll(/[A-Za-z]+\.?/g)];
  let best: { from: number; to: number; days: Weekday[]; strong: boolean; score: number } | undefined;
  for (let i = 0; i < words.length; i++) {
    const before = text[words[i].index! - 1];
    if (before && /[\w]/.test(before)) continue; // part of a code like "IT101"
    if (/^(?:Ms|MS|Mrs|Sr|St)\.?$/.test(words[i][0]) && /^\.?\s+[A-Z]/.test(text.slice(words[i].index! + words[i][0].length - (words[i][0].endsWith('.') ? 1 : 0)))) continue; // "Ms. De Juan"
    let j = i;
    const days: Weekday[] = [];
    let strong = true;
    let letters = 0;
    while (j < words.length) {
      const w = words[j];
      const after = text[w.index! + w[0].length];
      if (after && /\w/.test(after)) break;
      const d = readDayToken(w[0]);
      if (!d) break;
      if (j > i) {
        const gap = text.slice(words[j - 1].index! + words[j - 1][0].length, w.index!);
        if (!/^\s*[/&,\-–]?\s*$/.test(gap) || gap.length > 3) break;
      }
      days.push(...d.days);
      strong &&= d.strong;
      letters += w[0].length;
      j++;
    }
    if (j === i) continue;
    const tail = text.slice(words[j - 1].index! + words[j - 1][0].length);
    // "Rm 108" is a room and "JUAN M." an initial, not days.
    if (!strong && /^\s*\d/.test(tail)) continue;
    if (j - i === 1 && /^[A-Z]\.$/.test(words[i][0]) && /[A-Z]{2,}\s*,?\s*$/.test(text.slice(0, words[i].index!))) continue;
    // A lone lowercase letter or two is weak evidence; prefer longer, capitalised runs.
    const score = letters + (strong ? 10 : 0) + (j - i);
    if (!best || score > best.score) best = { from: words[i].index!, to: words[j - 1].index! + words[j - 1][0].length, days: [...new Set(days)], strong, score };
  }
  if (best) {
    return { days: best.days, strong: best.strong, span: text.slice(best.from, best.to), without: text.slice(0, best.from) + ' ' + text.slice(best.to) };
  }
  // OCR sometimes adds a stray letter to a day code ("MWEF" for "MWF").
  const noisy = text.match(/\b[MTWFS][MTWFSEhH]{1,5}\b/);
  if (noisy) {
    const d = parseDays(noisy[0].replace(/[EH]/g, (c) => (c === 'H' ? 'h' : '')));
    if (d) return { days: d.days, strong: false, span: noisy[0], without: text.slice(0, noisy.index!) + ' ' + text.slice(noisy.index! + noisy[0].length) };
  }
  return undefined;
}

function cleanTitle(text: string): string {
  return text
    .replace(/\s*[|¦]\s*/g, ' ') // table borders read as "|"
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s|:;,\-–]+|[\s|:;,\-–]+$/g, '')
    .trim();
}

/**
 * Reads schedule text (one row per line) and returns one event per day per class.
 * A row like "HCI II  MW  10:00-12:00 PM  Room 204  Prof. De Juan" becomes two events.
 */
export function parseScheduleText(input: string | string[]): ExtractedEvent[] {
  const lines = (Array.isArray(input) ? input : input.split(/\r?\n/)).map((l) => l.trim()).filter(Boolean);
  const out: ExtractedEvent[] = [];
  // Some schedules print the day once as a heading ("MONDAY") above its classes.
  let headingDay: { days: Weekday[]; strong: boolean } | undefined;

  // The class a line belongs to, for rows that only add a second time slot.
  let last: { title?: string; courseCode?: string; organizer?: string } | undefined;

  for (const line of lines) {
    const ranges: NonNullable<ReturnType<typeof readRange>>[] = [];
    let rest = line;
    for (let r = readRange(rest); r && ranges.length < 4; r = readRange(rest)) {
      ranges.push(r);
      rest = rest.replace(r.span, ' ');
    }
    if (!ranges.length) {
      const d = readDays(line);
      if (d && cleanTitle(d.without).length === 0) headingDay = d;
      continue;
    }
    // Each time slot may carry its own day ("01:00-03:40 PM Fri  03:40-07:00 PM Fri").
    const dayList: { days: Weekday[]; strong: boolean }[] = [];
    // A later single letter is more likely an initial ("JUAN M.") than a day.
    for (let d = readDays(rest); d && dayList.length < 4 && (!dayList.length || d.span.length >= 3); d = readDays(rest)) {
      dayList.push(d);
      rest = d.without;
    }

    let location: string | undefined;
    const room = rest.match(ROOM);
    if (room) {
      location = room[0].replace(/^rm\.?/i, 'Room').replace(/\s+/g, ' ').trim();
      rest = rest.replace(room[0], ' ');
    } else {
      const named = rest.match(ROOM_NAMED);
      const short = named ? undefined : rest.match(ROOM_SHORT);
      if (named) {
        location = tidyRoom(named[0]);
        rest = rest.replace(new RegExp(ROOM_NAMED.source, 'gi'), ' ');
      } else if (short) {
        location = short[0].toUpperCase().replace(/^([A-Z]+)\s?-?(\d)/, '$1 $2');
        if (!/\d|AVR|TBA/.test(location)) location = location[0] + location.slice(1).toLowerCase();
        rest = rest.replace(short[0], ' ');
      }
    }
    // Section column ("BSIT 3", "BSIT-3A").
    rest = rest.replace(/\bBS[A-Z]{1,5}\s?-?\d[A-Z]?\b/g, ' ');
    let organizer: string | undefined;
    const labeled = rest.match(ORGANIZER_LABEL);
    const titled = rest.match(ORGANIZER);
    if (labeled) {
      organizer = labeled[1].replace(/\s+/g, ' ').trim();
      rest = rest.replace(labeled[0], ' ');
    } else if (titled) {
      organizer = titled[0].replace(/\s+/g, ' ').trim();
      rest = rest.replace(titled[0], ' ');
    } else {
      // Registration forms list the instructor as "DELA CRUZ, JUAN M."
      const comma = rest.match(/\b[A-Z][A-Za-z'-]+(?:\s[A-Z][A-Za-z'-]+)?,\s*[A-Z][A-Za-z'.-]+(?:\s[A-Z][A-Za-z'.-]*)*/);
      if (comma) { organizer = comma[0].trim(); rest = rest.replace(comma[0], ' '); }
    }
    let title = cleanTitle(rest);
    let courseCode: string | undefined;
    const code = title.match(COURSE_CODE);
    if (code) { courseCode = `${code[1]} ${code[2]}`; title = code[3].trim(); }
    // Drop form columns that are not part of the name: units ("3.0"), section ("BSIT-3A"), lec/lab hours.
    title = cleanTitle(title
      .replace(/\b(?:BS[A-Z]{1,5}|[A-Z]{2,5})\s?-?\s?\d[A-Z]\b/g, ' ')
      .replace(/(?:^|\s)\d{1,2}\.\d{1,2}(?=\s|$)/g, ' ')
      // Several bare numbers in a row are unit/hour columns; one alone may be part of the name ("Programming 1").
      .replace(/(?:\s\d{1,2}){2,}(?=\s|$)/g, ' ')
      .replace(/\b(?:LEC|LAB|UNITS?)\b/gi, ' '));
    // An all-capitals name after a normal-case title is the professor ("Data Structures  GAYUTIN RONILO B.").
    if (!organizer) {
      const caps = title.match(/(?:^|\s)((?:[A-Z][A-Z'.-]+|[A-Z]\.?)(?:\s+(?:[A-Z][A-Z'.-]+|[A-Z]\.?)){1,5})$/);
      if (caps && /[a-z]/.test(title.slice(0, caps.index)) && /[A-Z]{3}/.test(caps[1])) {
        organizer = caps[1].replace(/[^A-Za-z.]+$/, '');
        title = title.slice(0, caps.index).trim();
      }
    }
    // Units left alone at the end ("Systems Administration 3"), only when a professor followed it.
    if (organizer) title = title.replace(/\s3(?:\.0{1,2})?$/, '');
    // A room code left at the end ("AB 204", "ITB-3").
    if (!location) {
      const tail = title.match(/\s([A-Z]{1,4}\s?-?\d{1,3}[A-Z]?)$/);
      if (tail && title.length - tail[0].length >= 3) { location = tail[1].replace(/\s?-?(\d)/, ' $1'); title = title.slice(0, -tail[0].length).trim(); }
    }
    // Drop OCR crumbs: short lowercase bits and stray symbols ("usu", "»").
    title = cleanTitle(title.replace(/^(?:[a-z]{1,4}\s+)+/, '').replace(/(?:^|\s)[^\w\s&'()-]+(?=\s|$)/g, ' '));

    // A row with only a time and room continues the class above it.
    const continues = !courseCode && !/[a-z]{3}/i.test(title) && last;
    if (continues) {
      title = last!.title ?? '';
      courseCode = last!.courseCode;
      organizer = organizer ?? last!.organizer;
    } else {
      last = { title: title || undefined, courseCode, organizer };
    }

    const base = {
      title: field(title.length ? title : undefined, title.length >= 3 && !continues ? 'high' : 'low'),
      courseCode: field(courseCode, 'high'),
      location: field(location, 'high'),
      organizer: field(organizer, 'high'),
      sourceText: line,
    };
    ranges.forEach((range, i) => {
      // Pair slots with days when the counts match; otherwise every slot uses all the days.
      const days = dayList.length === ranges.length ? dayList[i] : dayList.length ? merge(dayList) : headingDay;
      const timed = {
        ...base,
        startMin: field(range.start, range.sure ? 'high' : 'low'),
        endMin: field(range.end, range.sure ? 'high' : 'low'),
      };
      if (!days) {
        out.push({ ...timed, weekday: field<Weekday>(undefined, 'missing') });
      } else {
        for (const day of days.days) out.push({ ...timed, weekday: field(day, days.strong ? 'high' : 'low') });
      }
    });
  }
  return out;
}

/** Number of values the user still needs to look at (low or missing, ignoring optional ones). */
export function countNeedsReview(e: ExtractedEvent): number {
  const required = [e.title, e.weekday, e.startMin, e.endMin];
  const optional = [e.location, e.organizer];
  return required.filter((f) => f.confidence !== 'high').length + optional.filter((f) => f.confidence === 'low').length;
}
// --- Registration-form tables ------------------------------------------------
// A COR lists each class across columns (code, description, section, time,
// room, days, units, professor), and a class with two meetings has two time
// lines next to one description. Reading row by row mixes these up, so when
// the page has a column of times, cells are matched to their class by position.

interface Cell { text: string; x: number; right: number; y: number }

function cellsOf(lines: PositionedLine[]): Cell[] {
  const out: Cell[] = [];
  for (const l of lines) {
    if (!l.frame) continue;
    const per = l.frame.width / Math.max(1, l.text.length);
    // Words two or more spaces apart are separate cells.
    for (const m of l.text.matchAll(/\S+(?: \S+)*/g)) {
      const x = l.frame.left + per * m.index!;
      out.push({ text: m[0], x, right: x + per * m[0].length, y: l.frame.top + l.frame.height / 2 });
    }
  }
  return out;
}

const nearest = <T extends { y: number }>(list: T[], y: number) =>
  list.reduce<T | undefined>((b, c) => (!b || Math.abs(c.y - y) < Math.abs(b.y - y) ? c : b), undefined);

/** Where the code and days columns sit, so faint text there can be read again more closely. */
export interface TableRegions { code?: Box; days?: Box }
interface Box { left: number; top: number; width: number; height: number }

/** A misread three-letter day in the days column ("Moa", "Wcd"). Two of three letters must match. */
function fuzzyDay(text: string): Weekday | undefined {
  const t = text.trim().toLowerCase();
  if (t.length !== 3) return undefined;
  const names = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const hits = names.map((n) => [...n].filter((ch, i) => t[i] === ch).length);
  const best = Math.max(...hits);
  return best >= 2 && hits.filter((h) => h === best).length === 1 ? (hits.indexOf(best) as Weekday) : undefined;
}

export function readTable(lines: PositionedLine[], regions?: TableRegions): ExtractedEvent[] | undefined {
  const cells = cellsOf(lines);
  const times = cells.filter((c) => RANGE.test(c.text)).map((c) => ({ ...c, range: readRange(c.text)! })).filter((c) => c.range);
  if (times.length < 2) return undefined;
  // The time column: most times start at about the same x.
  const col = times.map((t) => t.x).sort((a, b) => a - b)[Math.floor(times.length / 2)];
  const slots = times.filter((t) => Math.abs(t.x - col) < 60).sort((a, b) => a.y - b.y);
  if (slots.length < 2) return undefined;
  const top = slots[0].y - 45;
  const bottom = slots[slots.length - 1].y + 45;
  const body = cells.filter((c) => c.y >= top && c.y <= bottom && !slots.includes(c as any));
  const timeRight = Math.max(...slots.map((s) => s.right));

  // Class names: the widest text left of the times, with lowercase letters.
  const left = body.filter((c) => c.right <= col + 10);
  const descs = left.filter((c) => /[a-z]{4}/.test(c.text) && c.right - c.x > 120);
  if (!descs.length) return undefined;
  const descX = Math.min(...descs.map((d) => d.x));
  const codes = left.filter((c) => c.right <= descX + 5);
  const right = body.filter((c) => c.x >= timeRight - 5);
  // Professors: all-capital names, far right.
  const people = right.filter((c) => /^[A-Z][A-Z'.,-]*(?:\s+[A-Z][A-Z'.,-]*)*$/.test(c.text) && /[A-Z]{3}/.test(c.text) && !ROOM_NAMED.test(c.text) && !readDays(c.text));
  const profX = people.length ? Math.max(...people.map((p) => p.x)) - 80 : Infinity;

  const classes = descs.sort((a, b) => a.y - b.y).map((d) => {
    const codeCell = nearest(codes.filter((c) => Math.abs(c.y - d.y) < 25), d.y);
    const code = codeCell?.text.toUpperCase().replace(/[|]/g, '').match(/([A-Z]{2,5})\s?-?(\d{2,4}[A-Z]?)\b/);
    return { d, code: code ? `${code[1]} ${code[2]}` : undefined, prof: [] as Cell[] };
  });
  const ownerOf = (y: number) => classes.find((c) => c.d === nearest(classes.map((k) => k.d), y))!;
  for (const p of people.filter((p) => p.x >= profX)) ownerOf(p.y).prof.push(p);

  if (regions) {
    const codeLeft = codes.length ? Math.min(...codes.map((c) => c.x)) : descX - 200;
    regions.code = { left: codeLeft - 30, top, width: descX - codeLeft + 25, height: bottom - top };
    const rooms = right.filter((c) => ROOM_NAMED.test(c.text));
    const roomRight = rooms.length ? Math.max(...rooms.map((c) => c.right)) : timeRight + 150;
    if (profX < Infinity && profX > roomRight) regions.days = { left: roomRight + 5, top, width: profX - roomRight - 10, height: bottom - top };
  }
  const out: ExtractedEvent[] = [];
  for (const s of slots) {
    const owner = ownerOf(s.y);
    const sameLine = right.filter((c) => Math.abs(c.y - s.y) < 12 && c.x < profX);
    let location: string | undefined;
    let days: { days: Weekday[]; strong: boolean } | undefined;
    for (const c of sameLine) {
      const d = readDays(c.text);
      if (d && cleanTitle(d.without).length === 0) { days = d; continue; }
      const fuzzy = fuzzyDay(c.text);
      if (fuzzy !== undefined) { days = { days: [fuzzy], strong: false }; continue; }
      if (!location && /[A-Za-z]{2}/.test(c.text) && !/^\d/.test(c.text)) {
        location = ROOM_NAMED.test(c.text) ? tidyRoom(c.text.match(ROOM_NAMED)![0]) : cleanTitle(c.text);
      }
    }
    const title = cleanTitle(owner.d.text.replace(/[|]/g, ' '));
    const organizer = owner.prof.sort((a, b) => a.y - b.y).map((p) => p.text).join(' ').replace(/\s+/g, ' ').trim() || undefined;
    const timed = {
      title: field(title, 'high'),
      courseCode: field(owner.code, 'high'),
      startMin: field(s.range.start, s.range.sure ? 'high' : 'low'),
      endMin: field(s.range.end, s.range.sure ? 'high' : 'low'),
      location: field(location, location ? 'high' : 'missing'),
      organizer: field(organizer, 'high'),
      sourceText: [owner.code, title, s.text, ...sameLine.map((c) => c.text)].filter(Boolean).join('  '),
    };
    if (!days) out.push({ ...timed, weekday: field<Weekday>(undefined, 'missing') });
    else for (const day of days.days) out.push({ ...timed, weekday: field(day, days.strong ? 'high' : 'low') });
  }
  return out;
}
