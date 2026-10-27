// Whether the device is online. Offline, ScheduLens opens for viewing only:
// saving and deleting are turned off until the connection is back.
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

const web = Platform.OS === 'web' && typeof navigator !== 'undefined';
export const isOnline = () => !web || navigator.onLine !== false;

function subscribe(cb: () => void) {
  if (!web) return () => {};
  window.addEventListener('online', cb);
  window.addEventListener('offline', cb);
  return () => { window.removeEventListener('online', cb); window.removeEventListener('offline', cb); };
}
export const useOnline = () => useSyncExternalStore(subscribe, isOnline, () => true);

/** Call before a change. Returns false (and tells the person why) when offline. */
export function canChange(): boolean {
  if (isOnline()) return true;
  if (web) window.alert("You're offline. You can look at your schedule, but changes are off until you're back online.");
  return false;
}
