// Local storage on the phone (SQLite). Your personal schedule never leaves
// the device unless you export it or share free/busy times with a group.
import * as SQLite from 'expo-sqlite';
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import type { ScheduleEvent, Weekday } from '../lib/types';
import { DEFAULT_RULES, type IssueRules } from '../lib/conflicts';

const SCHEMA = `
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY NOT NULL,
    title TEXT NOT NULL,
    weekday INTEGER NOT NULL,
    start_min INTEGER NOT NULL,
    end_min INTEGER NOT NULL,
    location TEXT,
    organizer TEXT,
    source_file_id TEXT
  );
  CREATE TABLE IF NOT EXISTS files (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    uri TEXT,
    kind TEXT NOT NULL,
    created_at TEXT NOT NULL,
    event_count INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );
`;

// On phones the database opens instantly. On the web it runs in a background
// worker that needs a moment to load, so it is opened asynchronously first and
// the app waits for `dbReady` before showing any screen (see app/_layout.tsx).
let db: SQLite.SQLiteDatabase;

// On the web, the schedule is kept with SQLite running in the page (sql.js)
// and saved to the browser's storage. expo-sqlite's web version is not used:
// its synchronous reads corrupt any result longer than 255 bytes, and it needs
// SharedArrayBuffer, which Safari-based and in-app browsers lack.
async function openWeb() {
  const { openFallbackDb } = await import('./fallbackDb');
  const { db: fb, restored } = await openFallbackDb(SCHEMA);
  db = fb as unknown as SQLite.SQLiteDatabase;
  if (!restored) await copyOldWebDatabase();
}

// Earlier web versions stored the schedule with expo-sqlite (in OPFS). Copy it
// over once, using only its asynchronous calls, so nobody loses their data.
async function copyOldWebDatabase() {
  if (typeof SharedArrayBuffer === 'undefined') return;
  try {
    const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000));
    const old = await Promise.race([SQLite.openDatabaseAsync('schedulens.db'), timeout]);
    for (const table of ['events', 'files', 'settings']) {
      const rows = await old.getAllAsync<Record<string, unknown>>(`SELECT * FROM ${table}`).catch(() => []);
      for (const r of rows) {
        const cols = Object.keys(r);
        db.runSync(`INSERT OR REPLACE INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`, ...(cols.map((c) => r[c]) as SQLite.SQLiteBindValue[]));
      }
    }
    await old.closeAsync();
  } catch (e) {
    console.warn('No earlier web data to copy', e);
  }
}

// Columns added after the first release. Added in place so existing
// schedules are kept (older databases simply get the new, empty columns).
const NEW_COLUMNS = [['course_code', 'TEXT'], ['notes', 'TEXT']] as const;
function migrate() {
  const cols = db.getAllSync<{ name: string }>('PRAGMA table_info(events)').map((c) => c.name);
  for (const [name, kind] of NEW_COLUMNS) if (!cols.includes(name)) db.execSync(`ALTER TABLE events ADD COLUMN ${name} ${kind}`);
}
export const dbReady: Promise<void> =
  Platform.OS === 'web'
    ? openWeb().then(migrate)
    : Promise.resolve();
if (Platform.OS !== 'web') {
  db = SQLite.openDatabaseSync('schedulens.db');
  db.execSync(SCHEMA);
  migrate();
}

export interface SavedFile {
  id: string;
  name: string;
  uri: string | null;
  kind: 'image' | 'pdf' | 'manual';
  createdAt: string;
  eventCount: number;
}

type EventRow = {
  id: string; title: string; weekday: number; start_min: number; end_min: number;
  location: string | null; organizer: string | null; source_file_id: string | null;
  course_code?: string | null; notes?: string | null;
};

const fromRow = (r: EventRow): ScheduleEvent => ({
  id: r.id,
  title: r.title,
  weekday: r.weekday as Weekday,
  startMin: r.start_min,
  endMin: r.end_min,
  location: r.location ?? undefined,
  organizer: r.organizer ?? undefined,
  sourceFileId: r.source_file_id ?? undefined,
  courseCode: r.course_code ?? undefined,
  notes: r.notes ?? undefined,
});

export const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

// --- A tiny store so screens re-render when data changes ---------------------
let version = 0;
const listeners = new Set<() => void>();
const changed = () => {
  version++;
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
let cache: { v: number; events: ScheduleEvent[]; files: SavedFile[] } = { v: -1, events: [], files: [] };
function snapshot() {
  if (cache.v !== version) {
    const events = db.getAllSync<EventRow>('SELECT * FROM events ORDER BY weekday, start_min').map(fromRow);
    const files = db
      .getAllSync<{ id: string; name: string; uri: string | null; kind: SavedFile['kind']; created_at: string; event_count: number }>(
        'SELECT * FROM files ORDER BY created_at DESC',
      )
      .map((f) => ({ id: f.id, name: f.name, uri: f.uri, kind: f.kind, createdAt: f.created_at, eventCount: f.event_count }));
    cache = { v: version, events, files };
  }
  return cache;
}
export const useEvents = () => useSyncExternalStore(subscribe, () => snapshot().events);
export const useFiles = () => useSyncExternalStore(subscribe, () => snapshot().files);

// --- Events ------------------------------------------------------------------
const INSERT_EVENT = `INSERT OR REPLACE INTO events (id, title, weekday, start_min, end_min, location, organizer, source_file_id, course_code, notes)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
const eventValues = (e: ScheduleEvent) => [
  e.id, e.title, e.weekday, e.startMin, e.endMin, e.location ?? null, e.organizer ?? null, e.sourceFileId ?? null, e.courseCode ?? null, e.notes ?? null,
] as const;

export function getEvent(id: string): ScheduleEvent | undefined {
  const r = db.getFirstSync<EventRow>('SELECT * FROM events WHERE id = ?', id);
  return r ? fromRow(r) : undefined;
}

export function saveEvent(e: ScheduleEvent) {
  db.runSync(
    INSERT_EVENT, ...eventValues(e),
  );
  changed();
}

/**
 * Saves the timetable editor's changes in one transaction: every event in
 * `events` is written, and only the ids in `deletedIds` are removed.
 */
export function saveEditorChanges(events: ScheduleEvent[], deletedIds: string[]) {
  db.withTransactionSync(() => {
    for (const id of deletedIds) db.runSync('DELETE FROM events WHERE id = ?', id);
    for (const e of events) db.runSync(INSERT_EVENT, ...eventValues(e));
  });
  changed();
}

export function deleteEvent(id: string) {
  db.runSync('DELETE FROM events WHERE id = ?', id);
  changed();
}

/** Saves a verified import in one transaction, so a failure saves nothing. */
export function saveImport(file: Omit<SavedFile, 'eventCount' | 'createdAt'>, events: ScheduleEvent[]) {
  db.withTransactionSync(() => {
    db.runSync(
      'INSERT OR REPLACE INTO files (id, name, uri, kind, created_at, event_count) VALUES (?, ?, ?, ?, ?, ?)',
      file.id, file.name, file.uri, file.kind, new Date().toISOString(), events.length,
    );
    for (const e of events) {
      db.runSync(INSERT_EVENT, ...eventValues({ ...e, sourceFileId: file.id }));
    }
  });
  changed();
}

export function deleteFile(id: string, alsoEvents: boolean) {
  db.withTransactionSync(() => {
    if (alsoEvents) db.runSync('DELETE FROM events WHERE source_file_id = ?', id);
    db.runSync('DELETE FROM files WHERE id = ?', id);
  });
  changed();
}

export function deleteAllData() {
  db.execSync('DELETE FROM events; DELETE FROM files;');
  changed();
}

// --- Settings ----------------------------------------------------------------
export function getSetting<T>(key: string, fallback: T): T {
  const r = db.getFirstSync<{ value: string }>('SELECT value FROM settings WHERE key = ?', key);
  return r ? (JSON.parse(r.value) as T) : fallback;
}
export function setSetting(key: string, value: unknown) {
  db.runSync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', key, JSON.stringify(value));
  changed();
}
export const getRules = (): IssueRules => getSetting('rules', DEFAULT_RULES);
/** Which kinds of warnings the person wants to see (Settings > Alerts). */
export type AlertKinds = { overlap: boolean; travel: boolean; workload: boolean };
export const getAlerts = (): AlertKinds => ({ overlap: true, travel: true, workload: true, ...getSetting<Partial<AlertKinds>>('alerts', {}) });

// --- Backup ------------------------------------------------------------------
// Moves the schedule between a browser and the installed app (which keep
// separate storage on iPhone) as a file the person saves and opens themselves.
const BACKUP_TABLES = ['events', 'files', 'settings'] as const;

export function exportBackup(): string {
  const data: Record<string, unknown[]> = {};
  for (const t of BACKUP_TABLES) data[t] = db.getAllSync(`SELECT * FROM ${t}`);
  return JSON.stringify({ app: 'schedulens', version: 1, savedAt: new Date().toISOString(), data });
}

/** Replaces this device's events and files with the backup's, and adds its settings. Returns the event count. */
export function importBackup(text: string): number {
  const b = JSON.parse(text);
  if (b?.app !== 'schedulens' || !b.data) throw new Error('This is not a ScheduLens backup file.');
  db.execSync('DELETE FROM events; DELETE FROM files;');
  for (const t of BACKUP_TABLES) {
    for (const r of (b.data[t] ?? []) as Record<string, unknown>[]) {
      const cols = Object.keys(r).filter((c) => /^\w+$/.test(c));
      if (!cols.length) continue;
      db.runSync(`INSERT OR REPLACE INTO ${t} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`, ...cols.map((c) => r[c] as string | number | null));
    }
  }
  changed();
  return (b.data.events ?? []).length;
}
