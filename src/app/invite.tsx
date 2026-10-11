// 4.2 Share Invite. Shows the group's code as text and a QR code.
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Platform, Share, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Badge, Button, Card, Icon, Screen, T } from '../components/ui';
import { colors, space } from '../theme/tokens';

export default function Invite() {
  const { name, code, expiresAt } = useLocalSearchParams<{ name: string; code: string; expiresAt: string }>();
  const [copied, setCopied] = useState(false);
  const message = `Join my ScheduLens group "${name}" with code ${code}`;
  async function copy() {
    await Clipboard.setStringAsync(code ?? '');
    setCopied(true);
  }
  return (
    <Screen title="Invite Members" back>
      <T v="section" center>{name}</T>
      <T v="caption" center color={colors.textSecondary}>Code expires {expiresAt ? new Date(expiresAt).toLocaleDateString() : ''}</T>
      <Card style={{ alignItems: 'center', gap: space.md }}>
        <QRCode value={code ?? ''} size={160} color={colors.text} />
        <T v="welcome">{code}</T>
        <View style={{ flexDirection: 'row', gap: space.md }}>
          <Button kind="secondary" label="Copy" icon="copy-outline" onPress={copy} />
          {Platform.OS !== 'web' && <Button kind="tonal" label="Share" icon="share-social-outline" onPress={() => Share.share({ message })} />}
        </View>
        {copied && <Badge tone="success" label="Code copied." />}
      </Card>
      <T v="cardTitle">What members will share</T>
      <Card style={{ gap: space.md }}>
        {([['checkmark-circle', colors.success, 'Busy and free times for each weekday'], ['close-circle', colors.error, 'Event titles, rooms, and instructors'], ['close-circle', colors.error, 'Notes or uploaded files']] as const).map(([icon, color, text]) => (
          <View key={text} style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
            <Icon name={icon} color={color} />
            <T style={{ flex: 1 }}>{text}</T>
          </View>
        ))}
      </Card>
    </Screen>
  );
}
