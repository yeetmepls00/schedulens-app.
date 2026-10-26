// "Add to Home Screen" card. Web only: uses the browser install prompt where offered, otherwise shows steps.
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { Button, Card, T } from './ui';
import { colors, space } from '../theme/tokens';

type PromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
let deferred: PromptEvent | null = null;
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e as PromptEvent; });
}

function isInstalled() {
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
}

export function InstallApp() {
  const [installed, setInstalled] = useState(false);
  const [canPrompt, setCanPrompt] = useState(false);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    setInstalled(isInstalled());
    setCanPrompt(!!deferred);
    const onPrompt = () => setCanPrompt(true);
    const onInstalled = () => setInstalled(true);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => { window.removeEventListener('beforeinstallprompt', onPrompt); window.removeEventListener('appinstalled', onInstalled); };
  }, []);
  if (Platform.OS !== 'web') return null;

  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    deferred = null; setCanPrompt(false);
    if (outcome === 'accepted') setInstalled(true);
  }

  return (
    <Card style={{ gap: space.sm }}>
      <T v="cardTitle">Add to Home Screen</T>
      {installed ? (
        <T color={colors.textSecondary}>ScheduLens is installed. Open it from your home screen.</T>
      ) : canPrompt ? (
        <>
          <T color={colors.textSecondary}>Get a ScheduLens icon on your home screen. It opens full screen, like an app.</T>
          <Button kind="tonal" icon="cloud-download-outline" label="Install ScheduLens" onPress={install} />
        </>
      ) : (
        <T color={colors.textSecondary}>
          {ios
            ? 'In Safari, tap the Share button, then "Add to Home Screen".'
            : 'Open your browser menu (⋮), then tap "Add to Home screen" or "Install app".'}
        </T>
      )}
    </Card>
  );
}
