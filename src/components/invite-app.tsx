// "Invite friends to ScheduLens": share the app link or show it as a QR code.
import { useState } from 'react';
import { Linking, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { APP_URL, shareApp } from '../lib/qr';
import { colors, space } from '../theme/tokens';
import { Badge, Button, Card, T } from './ui';

export function InviteAppCard() {
  const [qr, setQr] = useState(false);
  const [note, setNote] = useState('');
  async function share() {
    try { setNote((await shareApp()) === 'copied' ? 'Link copied. Paste it in a chat.' : ''); } catch { setNote('Share this link: ' + APP_URL); }
  }
  return (
    <Card style={{ gap: space.sm, alignItems: 'center' }}>
      <T v="cardTitle" center>Invite friends to ScheduLens 💌</T>
      <T v="caption" color={colors.textSecondary} center>Send the app link, or let them scan the QR code.</T>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Button icon="share-social-outline" label="Share link" onPress={share} />
        <Button kind="tonal" icon="qr-code-outline" label={qr ? 'Hide QR' : 'Show QR'} onPress={() => setQr(!qr)} />
      </View>
      {note ? <Badge tone="success" label={note} /> : null}
      {qr && (
        <View style={{ alignItems: 'center', gap: 6, padding: space.md, backgroundColor: colors.white, borderRadius: 20, borderWidth: 1, borderColor: colors.border }}>
          <QRCode value={APP_URL} size={180} color={colors.text} />
          <T v="caption" color={colors.textSecondary} center>Scan with a phone camera to open ScheduLens.</T>
        </View>
      )}
    </Card>
  );
}

export const EVALUATION_URL = 'https://tinyurl.com/ScheduLens-Evaluation-Form';

/** "Rate ScheduLens": opens the user evaluation form, or shows it as a QR code. */
export function EvaluationCard() {
  const [qr, setQr] = useState(false);
  return (
    <Card style={{ gap: space.sm, alignItems: 'center' }}>
      <T v="cardTitle" center>Help us improve ScheduLens 📝</T>
      <T v="caption" color={colors.textSecondary} center>Tell us how the app worked for you. It takes a few minutes.</T>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Button icon="open-outline" label="Open form" onPress={() => Linking.openURL(EVALUATION_URL)} />
        <Button kind="tonal" icon="qr-code-outline" label={qr ? 'Hide QR' : 'Show QR'} onPress={() => setQr(!qr)} />
      </View>
      {qr && (
        <View style={{ alignItems: 'center', gap: 6, padding: space.md, backgroundColor: colors.white, borderRadius: 20, borderWidth: 1, borderColor: colors.border }}>
          <QRCode value={EVALUATION_URL} size={180} color={colors.text} />
          <T v="caption" color={colors.textSecondary} center>Scan with a phone camera to open the evaluation form.</T>
        </View>
      )}
    </Card>
  );
}
