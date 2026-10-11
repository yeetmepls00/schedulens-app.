import { useSyncExternalStore } from 'react';

// --- Types & Core State ----------------------------------------------------
export interface AppEvent {
  id: string;
  title: string;
  date: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  description?: string;
  group?: string;
}

export interface AppFile {
  id: string;
  name: string;
  uri: string;
  type: string;
}

interface StoreState {
  events: AppEvent[];
  files: AppFile[];
}

let memoryState: StoreState = {
  events: [],
  files: [],
};

const listeners = new Set<() => void>();

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getState(): StoreState {
  return memoryState;
}

export function setState(newState: Partial<StoreState>) {
  memoryState = { ...memoryState, ...newState };
  listeners.forEach((listener) => listener());
}

// --- Cached Selectors (Fixes the getSnapshot infinite loop error) -----------
const getEventsSnapshot = () => memoryState.events;
const getFilesSnapshot = () => memoryState.files;

export const useEvents = () => useSyncExternalStore(subscribe, getEventsSnapshot);
export const useFiles = () => useSyncExternalStore(subscribe, getFilesSnapshot);

// --- Actions ---------------------------------------------------------------
export const db = {
  getEvents: () => memoryState.events,
  addEvent: (event: AppEvent) => {
    setState({ events: [...memoryState.events, event] });
  },
  removeEvent: (id: string) => {
    setState({ events: memoryState.events.filter((e) => e.id !== id) });
  },
  getFiles: () => memoryState.files,
  addFile: (file: AppFile) => {
    setState({ files: [...memoryState.files, file] });
  },
  removeFile: (id: string) => {
    setState({ files: memoryState.files.filter((f) => f.id !== id) });
  },
};