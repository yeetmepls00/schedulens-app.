// Brand pieces shared by the onboarding and sign-in screens: the app mark,
// the sign-in layout, and the three-step sign-up progress.
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { colors, radius, space } from '../theme/tokens';
import { Icon, Screen, T } from './ui';

/** The ScheduLens mark: a calendar under a lens, on a strawberry tile. */
export function BrandMark({ size = 72 }: { size?: number }) {
  const badge = size * 0.42;
  return (
    <View style={{ width: size, height: size }} accessibilityRole="image" accessibilityLabel="ScheduLens">
      <LinearGradient colors={['#E8506A', '#B8324B']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ flex: 1, borderRadius: size * 0.28, alignItems: 'center', justifyContent: 'center',
          shadowColor: '#B8324B', shadowOpacity: 0.28, shadowRadius: size * 0.2, shadowOffset: { width: 0, height: size * 0.08 } }}>
        <Icon name="calendar-clear-outline" size={size * 0.52} color="#FFFFFF" />
      </LinearGradient>
      <View style={{ position: 'absolute', right: -size * 0.08, bottom: -size * 0.08, width: badge, height: badge, borderRadius: badge / 2,
        backgroundColor: colors.matchaSoft, borderWidth: Math.max(2, size * 0.04), borderColor: colors.white, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="search" size={badge * 0.5} color={colors.matchaStrong} />
      </View>
    </View>
  );
}

const STEPS = ['Account', 'Verify email', 'Terms'];
/** Sign-up progress: 0 = account details, 1 = confirm email, 2 = accept Terms. */
export function SignUpSteps({ step }: { step: number }) {
  return (
    <View accessibilityLabel={`Step ${step + 1} of 3: ${STEPS[step]}`} style={{ flexDirection: 'row', gap: space.sm }}>
      {STEPS.map((label, i) => {
        const done = i < step, now = i === step;
        return (
          <View key={label} style={{ flex: 1, gap: 6 }}>
            <View style={{ height: 4, borderRadius: radius.pill, backgroundColor: done || now ? colors.strawberryStrong : colors.border }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              {done && <Icon name="checkmark-circle" size={14} color={colors.success} />}
              <T v={now ? 'captionStrong' : 'caption'} color={now ? colors.strawberryStrong : colors.textSecondary}>{label}</T>
            </View>
          </View>
        );
      })}
    </View>
  );
}

/** Layout for Log In, Sign Up, password reset, and Terms: mark, title, a white card, and a footer line. */
export function AuthShell({ title, subtitle, steps, children, below, back = true }: {
  title: string; subtitle?: string; steps?: number; children: ReactNode; below?: ReactNode; back?: boolean;
}) {
  return (
    <Screen title={back ? '' : undefined} back={back} plain>
      <View style={{ width: '100%', maxWidth: 440, alignSelf: 'center', gap: space.xl }}>
        <View style={{ alignItems: 'center', gap: space.md, paddingTop: back ? 0 : space.xl }}>
          <BrandMark size={56} />
          <View style={{ alignItems: 'center', gap: space.xs }}>
            <T v="welcome" center>{title}</T>
            {subtitle && <T center color={colors.textSecondary}>{subtitle}</T>}
          </View>
        </View>
        {steps !== undefined && <SignUpSteps step={steps} />}
        <View style={{ backgroundColor: colors.white, borderRadius: 24, padding: space.xl, gap: space.lg,
          shadowColor: '#B8324B', shadowOpacity: 0.08, shadowRadius: 24, shadowOffset: { width: 0, height: 8 }, elevation: 3 }}>
          {children}
        </View>
        {below}
      </View>
    </Screen>
  );
}
