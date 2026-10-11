// 1.5 Terms and Conditions. Continue -> 2.1 Home. Continue turns on after the box is ticked.
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Banner, Button, Card, Checkbox, Icon, Screen, T, type IconName } from '../components/ui';
import { acceptTermsAndFinish } from '../lib/auth';
import { colors, space } from '../theme/tokens';

const ITEMS: [IconName, string, string][] = [
  ['calendar-outline', 'Schedule Information', 'How we collect and use your schedule data'],
  ['sync-outline', 'Calendar Synchronization', 'How we connect with your calendar accounts'],
  ['people-outline', 'Group Sharing', 'Only free and busy times are shared'],
  ['shield-checkmark-outline', 'Privacy', 'How we protect your information'],
  ['warning-outline', 'Limitation of Liability', 'How we handle service availability'],
];

export default function Terms() {
  const { confirm } = useLocalSearchParams<{ confirm?: string }>();
  const [agree, setAgree] = useState(false);
  function finish() {
    acceptTermsAndFinish();
    router.dismissAll();
    router.replace('/');
  }
  return (
    <Screen title="Terms and Conditions" back>
      {confirm === '1' && <Banner tone="matcha" title="Confirm your email" message="We sent you a link. You can keep using ScheduLens; confirm before you log in on another device." />}
      <T color={colors.textSecondary}>Please review how ScheduLens handles your schedule before you continue.</T>
      <Card style={{ gap: space.md }}>
        {ITEMS.map(([icon, title, sub]) => (
          <View key={title} style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.header, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={icon} size={20} color={colors.strawberry} />
            </View>
            <View style={{ flex: 1 }}>
              <T v="label">{title}</T>
              <T v="caption" color={colors.textSecondary}>{sub}</T>
            </View>
          </View>
        ))}
      </Card>
      <Checkbox label="I have read and agree to the Terms" on={agree} onPress={() => setAgree(!agree)} />
      <Button label="Continue" onPress={finish} disabled={!agree} />
      {!agree && <T v="caption" color={colors.textSecondary}>Continue turns on after you tick the box.</T>}
    </Screen>
  );
}
