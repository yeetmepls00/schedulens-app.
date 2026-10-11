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

// Some phone browsers cannot keep a saved database file (or take too long to
// open one). Rather than leave a blank screen, fall back to a temporary
// in-memory database for that visit.
async function openWeb() {
  // The web database's quick (synchronous) reads need SharedArrayBuffer, which
  // in-app browsers such as Messenger do not provide. The app explains this
  // instead of starting (see app/_layout.tsx).
  if (typeof SharedArrayBuffer === 'undefined') throw new Error('unsupported browser');
  const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000));
  try {
    const d = await Promise.race([SQLite.openDatabaseAsync('schedulens.db'), timeout]);
    await d.execAsync(SCHEMA);
    db = d;
  } catch (e) {
    console.warn('Saved storage unavailable, using temporary storage', e);
    const d = await SQLite.openDatabaseAsync(':memory:');
    await d.execAsync(SCHEMA.replace('PRAGMA journal_mode = WAL;', ''));
    db = d;
  }
}
export const dbReady: Promise<void> =
  Platform.OS === 'web'
    ? openWeb()
    : Promise.resolve();
if (Platform.OS !== 'web') {
  db = SQLite.openDatabaseSync('schedulens.db');
  db.execSync(SCHEMA);
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
export function getEvent(id: string): ScheduleEvent | undefined {
  const r = db.getFirstSync<EventRow>('SELECT * FROM events WHERE id = ?', id);
  return r ? fromRow(r) : undefined;
}

export function saveEvent(e: ScheduleEvent) {
  db.runSync(
    `INSERT OR REPLACE INTO events (id, title, weekday, start_min, end_min, location, organizer, source_file_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    e.id, e.title, e.weekday, e.startMin, e.endMin, e.location ?? null, e.organizer ?? null, e.sourceFileId ?? null,
  );
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
      db.runSync(
        `INSERT OR REPLACE INTO events (id, title, weekday, start_min, end_min, location, organizer, source_file_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        e.id, e.title, e.weekday, e.startMin, e.endMin, e.location ?? null, e.organizer ?? null, file.id,
      );
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
