// A confirm dialog that works on phones and on the website.
// (React Native's Alert does nothing in a web browser.)
import { Alert, Platform } from 'react-native';

export interface Choice { text: string; destructive?: boolean; onPress: () => void }

/** Shows a title, a message, a Cancel button, and the given choices. */
export function confirm(title: string, message: string, choices: Choice[]) {
  if (Platform.OS === 'web') {
    // The browser dialog has only OK and Cancel, so each choice is asked in turn.
    for (const c of choices) {
      if (window.confirm(`${title}\n\n${message}\n\nOK = ${c.text}`)) return c.onPress();
    }
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    ...choices.map((c) => ({ text: c.text, style: c.destructive ? ('destructive' as const) : ('default' as const), onPress: c.onPress })),
  ]);
}
