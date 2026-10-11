// Timetable design: presets, the saved appearance settings, block layout, and
// the editor's undo/redo history.
//
// Appearance is stored separately from the schedule (setting "timetableStyle"),
// so changing a design never changes class times, titles, or rooms.
import type { ScheduleEvent, Weekday } from './types';

export type PresetId = 'minimalist' | 'pastel' | 'colorCoded' | 'dark' | 'planner';
/** How a class block is drawn. Each preset uses a different one. */
export type BlockStyle = 'outline' | 'soft' | 'solid' | 'glow' | 'planner';

export interface TimetableStyle {
  preset: PresetId;
  background: string;
  gridLine: string;
  text: string;
  mutedText: string;
  blockStyle: BlockStyle;
  /** Colors given to subjects in turn. */
  palette: string[];
  /** Colors the student picked for a subject (key: subject name in lower case). */
  subjectColors: Record<string, string>;
  /** 0.85 small, 1 normal, 1.2 large. */
  fontScale: number;
  bold: boolean;
  showCode: boolean;
  showRoom: boolean;
  showInstructor: boolean;
  showNotes: boolean;
  days: Weekday[];
  startHour: number;
  endHour: number;
  /** Height of one hour in the grid, in points. */
  hourHeight: number;
}

export interface Preset {
  id: PresetId;
  name: string;
  description: string;
  style: Omit<TimetableStyle, 'subjectColors' | 'days' | 'startHour' | 'endHour'>;
}

export const PRESETS: Preset[] = [
  {
    id: 'minimalist', name: 'Minimalist', description: 'White page, thin outlines, and clear time labels. Nothing extra.',
    style: { preset: 'minimalist', background: '#FFFFFF', gridLine: '#EEEEEE', text: '#222222', mutedText: '#8A8A8A', blockStyle: 'outline',
      palette: ['#3A3A3A', '#6B6B6B', '#8C8C8C', '#4F4F4F', '#777777', '#5E5E5E'], fontScale: 0.95, bold: false,
      showCode: false, showRoom: true, showInstructor: false, showNotes: false, hourHeight: 44 },
  },
  {
    id: 'pastel', name: 'Pastel', description: 'Soft pastel blocks with rounded corners on a cream page. Calm and easy on the eyes.',
    style: { preset: 'pastel', background: '#FFF8F5', gridLine: '#F3D9DC', text: '#3A2A2C', mutedText: '#6B5B5D', blockStyle: 'soft',
      palette: ['#F7B8C2', '#DCE8C9', '#CDE3F5', '#FBE3B8', '#E3D4F2', '#FFD6C9'], fontScale: 1, bold: true,
      showCode: false, showRoom: true, showInstructor: false, showNotes: false, hourHeight: 48 },
  },
  {
    id: 'colorCoded', name: 'Color-Coded Subjects', description: 'Each subject gets its own bold color, with a legend, so classes stand out at a glance.',
    style: { preset: 'colorCoded', background: '#FFFFFF', gridLine: '#E5E5E5', text: '#1F1F1F', mutedText: '#666666', blockStyle: 'solid',
      palette: ['#D0344F', '#2F7D4F', '#2B65B5', '#C26A00', '#7A3FB0', '#00838F', '#8D5524'], fontScale: 1, bold: true,
      showCode: true, showRoom: true, showInstructor: false, showNotes: false, hourHeight: 48 },
  },
  {
    id: 'dark', name: 'Dark Mode', description: 'Dark page with glowing outlines and light text. Good at night, with readable contrast.',
    style: { preset: 'dark', background: '#1C1719', gridLine: '#3A3134', text: '#F5ECEE', mutedText: '#BFAFB2', blockStyle: 'glow',
      palette: ['#FF8FA3', '#A8D58A', '#8EC5FF', '#FFC870', '#C9A6FF', '#6FE0D8'], fontScale: 1, bold: true,
      showCode: false, showRoom: true, showInstructor: false, showNotes: false, hourHeight: 48 },
  },
  {
    id: 'planner', name: 'Planner Style', description: 'A paper planner: every hour labelled, tall slots with course code, room, instructor, and notes.',
    style: { preset: 'planner', background: '#FDFBF4', gridLine: '#D9D2BE', text: '#2C2A24', mutedText: '#6E6857', blockStyle: 'planner',
      palette: ['#B8324B', '#3F5A2C', '#2B65B5', '#8A6500', '#6B3F8C', '#00727C'], fontScale: 0.95, bold: false,
      showCode: true, showRoom: true, showInstructor: true, showNotes: true, hourHeight: 64 },
  },
];

export const presetById = (id: PresetId) => PRESETS.find((p) => p.id === id) ?? PRESETS[1];

const MON_SAT: Weekday[] = [1, 2, 3, 4, 5, 6];

export function styleFromPreset(id: PresetId, keep?: Pick<TimetableStyle, 'subjectColors' | 'days' | 'startHour' | 'endHour'>): TimetableStyle {
  return {
    ...presetById(id).style,
    subjectColors: keep?.subjectColors ?? {},
    days: keep?.days ?? MON_SAT,
    startHour: keep?.startHour ?? 7,
    endHour: keep?.endHour ?? 19,
  };
}

export const DEFAULT_STYLE = styleFromPreset('pastel');

/**
 * Switching preset: keeps the visible days and hours. Subject colors are
 * cleared unless asked, because they were picked for the old palette.
 */
export function applyPreset(current: TimetableStyle, id: PresetId, keepSubjectColors = false): TimetableStyle {
  return styleFromPreset(id, { ...current, subjectColors: keepSubjectColors ? current.subjectColors : {} });
}

const subjectKey = (e: Pick<ScheduleEvent, 'title'>) => e.title.trim().toLowerCase();

/** The color for an event: the student's pick, or the next palette color for its subject. */
export function colorFor(e: ScheduleEvent, all: ScheduleEvent[], style: TimetableStyle): string {
  const key = subjectKey(e);
  if (style.subjectColors[key]) return style.subjectColors[key];
  const subjects = [...new Set(all.map(subjectKey))].sort();
  return style.palette[subjects.indexOf(key) % style.palette.length] ?? style.palette[0];
}

/** Shows the hours that contain classes, rounded out to whole hours. */
export function fitHours(events: ScheduleEvent[], style: TimetableStyle): Pick<TimetableStyle, 'startHour' | 'endHour'> {
  if (!events.length) return { startHour: style.startHour, endHour: style.endHour };
  return {
    startHour: Math.max(0, Math.floor(Math.min(...events.map((e) => e.startMin)) / 60)),
    endHour: Math.min(24, Math.ceil(Math.max(...events.map((e) => e.endMin)) / 60)),
  };
}

export interface PlacedBlock {
  event: ScheduleEvent;
  /** Column inside the day when classes overlap (0-based), and how many columns. */
  column: number;
  columns: number;
  overlaps: boolean;
}

/** Places one day's events side by side when they overlap, so none is hidden. */
export function layoutDay(events: ScheduleEvent[]): PlacedBlock[] {
  const sorted = [...events].sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
  const out: PlacedBlock[] = [];
  let cluster: PlacedBlock[] = [];
  let clusterEnd = -1;
  const flush = () => {
    const n = Math.max(1, ...cluster.map((b) => b.column + 1));
    cluster.forEach((b) => { b.columns = n; b.overlaps = n > 1; });
    out.push(...cluster);
    cluster = [];
  };
  for (const e of sorted) {
    if (e.startMin >= clusterEnd && cluster.length) flush();
    const used = new Set(cluster.filter((b) => b.event.endMin > e.startMin).map((b) => b.column));
    let column = 0;
    while (used.has(column)) column++;
    cluster.push({ event: e, column, columns: 1, overlaps: false });
    clusterEnd = Math.max(clusterEnd, e.endMin);
  }
  if (cluster.length) flush();
  return out;
}

// --- Editor history -----------------------------------------------------------

export interface EditorState { events: ScheduleEvent[]; style: TimetableStyle }

export interface History { past: EditorState[]; present: EditorState; future: EditorState[] }

const LIMIT = 50;
export const startHistory = (present: EditorState): History => ({ past: [], present, future: [] });
export function commit(h: History, next: EditorState): History {
  return { past: [...h.past, h.present].slice(-LIMIT), present: next, future: [] };
}
export const undo = (h: History): History =>
  h.past.length ? { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future] } : h;
export const redo = (h: History): History =>
  h.future.length ? { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) } : h;

/** What changed between the saved events and the editor's events. */
export function diffEvents(saved: ScheduleEvent[], edited: ScheduleEvent[]) {
  const savedById = new Map(saved.map((e) => [e.id, e]));
  const editedIds = new Set(edited.map((e) => e.id));
  return {
    changed: edited.filter((e) => JSON.stringify(savedById.get(e.id)) !== JSON.stringify(e)),
    deletedIds: saved.filter((e) => !editedIds.has(e.id)).map((e) => e.id),
  };
}

/** Moves or resizes an event by whole steps, keeping it inside the day. */
export function nudge(e: ScheduleEvent, change: { startBy?: number; endBy?: number; dayBy?: number }): ScheduleEvent {
  let { startMin, endMin } = e;
  if (change.startBy) { startMin += change.startBy; endMin += change.startBy; }
  if (change.endBy) endMin += change.endBy;
  if (startMin < 0) { endMin -= startMin; startMin = 0; }
  if (endMin > 24 * 60) { startMin -= endMin - 24 * 60; endMin = 24 * 60; }
  if (endMin - startMin < 15) endMin = startMin + 15;
  const weekday = (((e.weekday + (change.dayBy ?? 0)) % 7) + 7) % 7 as Weekday;
  return { ...e, startMin, endMin, weekday };
}

/** Readable text color (dark or white) for a block color. */
export function textOn(hex: string): string {
  const m = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(m.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.4 ? '#1F1F1F' : '#FFFFFF';
}
