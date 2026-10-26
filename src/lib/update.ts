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
