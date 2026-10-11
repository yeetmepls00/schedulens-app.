// 1.1 Welcome. Shown on first launch only (Figma note on the Onboarding flow).
import { router } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';
import { Button, Icon, Screen, T } from '../components/ui';
import { markWelcomeSeen } from '../lib/auth';
import { colors, space } from '../theme/tokens';

export default function Welcome() {
  useEffect(markWelcomeSeen, []);
  return (
    <Screen scroll={false}>
      <View style={{ minHeight: 520, justifyContent: 'center', alignItems: 'center', gap: space.lg }}>
        <View style={{ width: 128, height: 128, borderRadius: 32, backgroundColor: colors.header, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="calendar-outline" size={72} color={colors.strawberry} />
        </View>
        <T v="brand" center>ScheduLens</T>
        <T center color={colors.textSecondary}>Snap, stitch, and stay on track.</T>
      </View>
      <Button label="Get Started" onPress={() => router.push('/signup')} />
      <Button kind="text" label="I already have an account" onPress={() => router.push('/login')} />
    </Screen>
  );
}
