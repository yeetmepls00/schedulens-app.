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

const T = String.raw`\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?|am|pm|a|p|h)?`;
const RANGE = new RegExp(String.raw`(${T})\s*(?:-|–|—|to)\s*(${T})`, 'i');
const ROOM = /\b(?:room|rm\.?|lab|bldg\.?|building)\s*[#:.]?\s*[A-Z0-9][A-Z0-9-]*\b(?:\s*,?\s*(?:bldg\.?|building)\s*[A-Z0-9]+)?/i;
const ORGANIZER = /\b(?:[Pp]rof|PROF|[Dd]r|DR|[Mm]rs?|MRS?|[Mm]s|MS|[Ee]ngr|ENGR|[Ss]ir|[Mm]a'?am)\.?\s+[A-Z][\w.'-]*(?:\s+[A-Z][\w.'-]*){0,3}/;
const ORGANIZER_LABEL = /\b(?:instructor|teacher|faculty|organizer)\s*[:\-]\s*([A-Z][\w.'-]*(?:\s+[A-Z][\w.'-]*){0,3})/i;
const DAY_WORD = /\b(?:mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:rs|rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)\b(?:\s*[/&,-]\s*\b(?:mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:rs|rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)\b)*/i;
// Packed codes are only trusted in capitals: "MWF", "TTh", "M", "Th".
const DAY_CODE = /\b(?:M|T|W|Th|TH|F|S|Su|Sa|R)(?:M|T|W|Th|TH|F|S|Su|Sa|R)*\b/;

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

function readDays(text: string): { days: Weekday[]; strong: boolean; span: string } | undefined {
  const word = text.match(DAY_WORD);
  if (word) {
    const d = parseDays(word[0]);
    if (d) return { ...d, span: word[0] };
  }
  const code = text.match(DAY_CODE);
  if (code) {
    const d = parseDays(code[0]);
    if (d) return { ...d, span: code[0] };
  }
  // OCR sometimes adds a stray letter to a day code ("MWEF" for "MWF").
  // Use the corrected days but mark them for review.
  const noisy = text.match(/\b[MTWFS][MTWFSEhH]{1,5}\b/);
  if (noisy) {
    const d = parseDays(noisy[0].replace(/[EH]/g, (c) => (c === 'H' ? 'h' : '')));
    if (d) return { days: d.days, strong: false, span: noisy[0] };
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

  for (const line of lines) {
    const range = readRange(line);
    if (!range) {
      const d = readDays(line);
      if (d && cleanTitle(line.replace(d.span, '')).length === 0) headingDay = d;
      continue;
    }
    let rest = line.replace(range.span, ' ');
    const d = readDays(rest);
    if (d) rest = rest.replace(d.span, ' ');
    const days = d ?? headingDay;

    let location: string | undefined;
    const room = rest.match(ROOM);
    if (room) {
      location = room[0].replace(/^rm\.?/i, 'Room').replace(/\s+/g, ' ').trim();
      rest = rest.replace(room[0], ' ');
    }
    let organizer: string | undefined;
    const labeled = rest.match(ORGANIZER_LABEL);
    const titled = rest.match(ORGANIZER);
    if (labeled) {
      organizer = labeled[1].replace(/\s+/g, ' ').trim();
      rest = rest.replace(labeled[0], ' ');
    } else if (titled) {
      organizer = titled[0].replace(/\s+/g, ' ').trim();
      rest = rest.replace(titled[0], ' ');
    }
    const title = cleanTitle(rest);

    const base = {
      title: field(title.length ? title : undefined, title.length >= 3 ? 'high' : 'low'),
      startMin: field(range.start, range.sure ? 'high' : 'low'),
      endMin: field(range.end, range.sure ? 'high' : 'low'),
      location: field(location, 'high'),
      organizer: field(organizer, 'high'),
      sourceText: line,
    };
    if (!days) {
      out.push({ ...base, weekday: field<Weekday>(undefined, 'missing') });
    } else {
      for (const day of days.days) {
        out.push({ ...base, weekday: field(day, days.strong ? 'high' : 'low') });
      }
    }
  }
  return out;
}

/** Number of values the user still needs to look at (low or missing, ignoring optional ones). */
export function countNeedsReview(e: ExtractedEvent): number {
  const required = [e.title, e.weekday, e.startMin, e.endMin];
  const optional = [e.location, e.organizer];
  return required.filter((f) => f.confidence !== 'high').length + optional.filter((f) => f.confidence === 'low').length;
}