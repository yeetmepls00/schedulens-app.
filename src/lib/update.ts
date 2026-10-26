// Whether a newer version of the web app is live (set by the check in public/index.html).
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

declare global { interface Window { __updateReady?: boolean } }

export function useUpdateReady(): boolean {
  const web = Platform.OS === 'web' && typeof window !== 'undefined';
  const [ready, setReady] = useState(web && !!window.__updateReady);
  useEffect(() => {
    if (!web) return;
    const on = () => setReady(true);
    window.addEventListener('schedulens-update', on);
    return () => window.removeEventListener('schedulens-update', on);
  }, [web]);
  return ready;
}

export const applyUpdate = () => window.location.reload();

/** Notes when the app has just been updated, so Notifications can say so until it is cleared. */
export function recordVersion() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  const cur = document.querySelector('script[src*="/_expo/static/js/web/entry-"]')?.getAttribute('src');
  if (!cur) return;
  const { getSetting, setSetting } = require('../data/db') as typeof import('../data/db');
  const before = getSetting<string>('appVersion', '');
  if (before && before !== cur) setSetting('updatedAt', new Date().toISOString());
  if (before !== cur) setSetting('appVersion', cur);
}
