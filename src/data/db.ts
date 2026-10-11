// Local storage on the phone (SQLite). Your personal schedule never leaves
// the device unless you export it or share free/busy times with a group.
import { Platform } from 'react-native';
import * as SQLite from 'expo-sqlite';
import { useSyncExternalStore } from 'react';
import type { ScheduleEvent, Weekday } from '../lib/types';
import { DEFAULT_RULES, type IssueRules } from '../lib/conflicts';

const isWeb = Platform.OS === 'web';
const db = (isWeb ? {} : SQLite.openDatabaseSync('schedulens.db')) as SQLite.SQLiteDatabase;

if (!isWeb) {
  db.execSync(`
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
  `);
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
  if (isWeb) return { v: 0, events: [], files: [] };
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
  if (isWeb) return undefined;
  const r = db.getFirstSync<EventRow>('SELECT * FROM events WHERE id = ?', id);
  return r ? fromRow(r) : undefined;
}

export function saveEvent(e: ScheduleEvent) {
  if (isWeb) return;
  db.runSync(
    `INSERT OR REPLACE INTO events (id, title, weekday, start_min, end_min, location, organizer, source_file_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    e.id, e.title, e.weekday, e.startMin, e.endMin, e.location ?? null, e.organizer ?? null, e.sourceFileId ?? null,
  );
  changed();
}

export function deleteEvent(id: string) {
  if (isWeb) return;
  db.runSync('DELETE FROM events WHERE id = ?', id);
  changed();
}

/** Saves a verified import in one transaction, so a failure saves nothing. */
export function saveImport(file: Omit<SavedFile, 'eventCount' | 'createdAt'>, events: ScheduleEvent[]) {
  if (isWeb) return;
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
  if (isWeb) return;
  db.withTransactionSync(() => {
    if (alsoEvents) db.runSync('DELETE FROM events WHERE source_file_id = ?', id);
    db.runSync('DELETE FROM files WHERE id = ?', id);
  });
  changed();
}

export function deleteAllData() {
  if (isWeb) return;
  db.execSync('DELETE FROM events; DELETE FROM files;');
  changed();
}

// --- Settings ----------------------------------------------------------------
export function getSetting<T>(key: string, fallback: T): T {
  if (isWeb) return fallback;
  const r = db.getFirstSync<{ value: string }>('SELECT value FROM settings WHERE key = ?', key);
  return r ? (JSON.parse(r.value) as T) : fallback;
}

export function setSetting(key: string, value: unknown) {
  if (isWeb) return;
  db.runSync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', key, JSON.stringify(value));
  changed();
}

export const getRules = (): IssueRules => getSetting('rules', DEFAULT_RULES);