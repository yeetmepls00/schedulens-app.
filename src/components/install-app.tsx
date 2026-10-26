// "Add to Home Screen" card. Web only: uses the browser install prompt where offered, otherwise shows steps.
import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
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

export function InstallApp({ hideWhenInstalled }: { hideWhenInstalled?: boolean } = {}) {
  const [installed, setInstalled] = useState(false);
  const [canPrompt, setCanPrompt] = useState(false);
  const [showSteps, setShowSteps] = useState(false);
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
  if (Platform.OS !== 'web' || (hideWhenInstalled && installed)) return null;

  const ua = navigator.userAgent;
  const ios = /iphone|ipad|ipod/i.test(ua);
  const android = /android/i.test(ua);
  const ANDROID: [string, string] = ['Android (Google Chrome)', 'Tap the ⋮ menu at the top right, then "Add to Home screen", then "Install".'];
  const IPHONE: [string, string] = ['iPhone or iPad (Safari)', 'Tap the Share button, then "Add to Home Screen", then "Add".'];
  const DESKTOP: [string, string] = ['Computer (Google Chrome or Edge)', 'Click the install icon at the right end of the address bar, or open the ⋮ menu and choose "Install ScheduLens".'];
  const steps = ios ? [IPHONE, ANDROID] : android ? [ANDROID, IPHONE] : [DESKTOP, ANDROID, IPHONE];
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
      ) : (
        <View style={{ gap: space.sm }}>
          <T color={colors.textSecondary}>Get a ScheduLens icon on your home screen. It opens full screen, like an app.</T>
          <Button kind="tonal" icon="cloud-download-outline" label="Install ScheduLens" onPress={canPrompt ? install : () => setShowSteps(true)} />
          {showSteps && !canPrompt && (
            <>
              <T v="caption" color={colors.textSecondary}>This browser does not let websites install apps with one tap, so it takes two quick steps:</T>
              {steps.map(([title, text]) => (
                <View key={title} style={{ gap: 2 }}>
                  <T v="captionStrong">{title}</T>
                  <T v="caption" color={colors.textSecondary}>{text}</T>
                </View>
              ))}
            </>
          )}
        </View>
      )}
    </Card>
  );
}
