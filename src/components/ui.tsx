// Reusable building blocks. Each one matches a component in the Figma file.
import { Ionicons } from '@expo/vector-icons';
import { goBack } from '../lib/nav';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, space, FONT, TOUCH, type } from '../theme/tokens';

export type IconName = ComponentProps<typeof Ionicons>['name'];
export const Icon = ({ name, size = 22, color = colors.text }: { name: IconName; size?: number; color?: string }) => (
  <Ionicons name={name} size={size} color={color} />
);

/** Full screen with the strawberry matcha gradient, a header, and scrolling content. */
export function Screen({ title, back, left, right, children, footer, scroll = true, plain }: {
  title?: string; back?: boolean; left?: ReactNode; right?: ReactNode; children: ReactNode; footer?: ReactNode; scroll?: boolean;
  /** Transparent header bar (onboarding and sign-in screens). */
  plain?: boolean;
}) {
  const body = <View style={{ padding: space.xl, gap: space.lg, paddingBottom: 120 }}>{children}</View>;
  return (
    <LinearGradient colors={[colors.gradientTop, colors.gradientMid, colors.gradientBottom]} locations={[0, 0.45, 1]} style={{ flex: 1 }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        {title !== undefined && (
          <View style={[s.header, plain && { backgroundColor: 'transparent' }]}>
            <View style={s.headerSide}>
              {back && (
                <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => goBack()} style={s.iconBtn}>
                  <Icon name="arrow-back" />
                </Pressable>
              )}
              {left}
            </View>
            <Text style={[type.screenTitle, { color: colors.text, flex: 1, textAlign: 'center' }]} numberOfLines={1}>{title}</Text>
            <View style={[s.headerSide, { alignItems: 'flex-end' }]}>{right}</View>
          </View>
        )}
        {scroll ? <PullScroll>{body}</PullScroll> : body}
        {footer && <View style={s.footer}><View style={{ flex: 1 }}>{footer}</View></View>}
      </SafeAreaView>
    </LinearGradient>
  );
}

type ButtonKind = 'primary' | 'secondary' | 'tonal' | 'text';
export function Button({ label, onPress, kind = 'primary', disabled, loading, icon, style }: {
  label: string; onPress?: () => void; kind?: ButtonKind; disabled?: boolean; loading?: boolean; icon?: IconName; style?: ViewStyle;
}) {
  const off = disabled || loading;
  const bg = off && kind === 'primary' ? colors.disabled
    : kind === 'primary' ? colors.strawberryStrong : kind === 'tonal' ? colors.matchaSoft : kind === 'secondary' ? colors.white : 'transparent';
  const fg = off && kind === 'primary' ? colors.textSecondary
    : kind === 'primary' ? colors.onAccent : kind === 'tonal' ? colors.matchaStrong : colors.strawberryStrong;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      disabled={off}
      onPress={onPress}
      style={({ pressed }) => [s.btn, { backgroundColor: bg, opacity: pressed ? 0.85 : 1 },
        kind === 'secondary' && { borderWidth: 1.5, borderColor: colors.strawberryStrong },
        kind === 'text' && { paddingHorizontal: space.sm }, style]}
    >
      {loading ? <ActivityIndicator color={fg} /> : icon ? <Icon name={icon} size={18} color={fg} /> : null}
      <Text numberOfLines={1} style={[type.button, { color: fg, flexShrink: 1 }]}>{loading ? 'Please wait…' : label}</Text>
    </Pressable>
  );
}

export const Card = ({ children, style, tint }: { children: ReactNode; style?: ViewStyle; tint?: string }) => (
  <View style={[s.card, tint ? { backgroundColor: tint } : null, style]}>{children}</View>
);

export const T = ({ children, v = 'body', color = colors.text, style, center, lines }: {
  children: ReactNode; v?: keyof typeof type; color?: string; style?: object; center?: boolean; lines?: number;
}) => (
  <Text numberOfLines={lines} style={[type[v], { color }, center && { textAlign: 'center' }, style]}>{children}</Text>
);

type Tone = 'success' | 'warning' | 'error' | 'neutral' | 'matcha';
const TONES: Record<Tone, { bg: string; fg: string; icon: IconName }> = {
  success: { bg: colors.successSurface, fg: colors.success, icon: 'checkmark-circle' },
  warning: { bg: colors.warningSurface, fg: colors.warning, icon: 'alert-circle' },
  error: { bg: colors.errorSurface, fg: colors.error, icon: 'close-circle' },
  neutral: { bg: colors.card, fg: colors.textSecondary, icon: 'time-outline' },
  matcha: { bg: colors.matchaSoft, fg: colors.matchaStrong, icon: 'leaf-outline' },
};

/** Status is always an icon plus a word, never color alone. */
export const Badge = ({ label, tone }: { label: string; tone: Tone }) => (
  <View style={[s.badge, { backgroundColor: TONES[tone].bg }]}>
    <Icon name={TONES[tone].icon} size={14} color={TONES[tone].fg} />
    <Text style={[type.captionStrong, { color: TONES[tone].fg }]}>{label}</Text>
  </View>
);

export function Banner({ tone, title, message, action, onAction }: {
  tone: Tone; title: string; message?: string; action?: string; onAction?: () => void;
}) {
  const t = TONES[tone];
  return (
    <View accessibilityRole="alert" style={[s.banner, { backgroundColor: t.bg, borderColor: t.fg }]}>
      <Icon name={t.icon} color={t.fg} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[type.captionStrong, { color: t.fg }]}>{title}</Text>
        {message ? <Text style={[type.caption, { color: colors.text }]}>{message}</Text> : null}
      </View>
      {action && (
        <Pressable onPress={onAction} hitSlop={12} accessibilityRole="button">
          <Text style={[type.captionStrong, { color: colors.strawberryStrong }]}>{action}</Text>
        </Pressable>
      )}
    </View>
  );
}

/** Text input with a label above and helper or error text below. */
export function Field({ label, error, helper, tone, ...input }: TextInputProps & {
  label: string; error?: string; helper?: string; tone?: 'low' | 'missing' | 'edited';
}) {
  const [hidden, setHidden] = useState(true);
  const secret = !!input.secureTextEntry;
  const border = error || tone === 'missing' ? colors.error : tone === 'low' ? colors.warning : tone === 'edited' ? colors.strawberry : colors.border;
  const bg = tone === 'low' ? colors.warningSurface : tone === 'missing' ? colors.errorSurface : colors.white;
  const note = error ?? (tone === 'low' ? 'Check this: low confidence' : tone === 'missing' ? 'Not found. Please fill in.' : tone === 'edited' ? 'Edited' : helper);
  const noteColor = error || tone === 'missing' ? colors.error : tone === 'low' ? colors.warning : tone === 'edited' ? colors.strawberryStrong : colors.textSecondary;
  return (
    <View style={{ gap: 6, flex: input.style ? undefined : 1 }}>
      <Text style={[type.label, { color: colors.text }]}>{label}</Text>
      <View>
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor={colors.textSecondary}
          {...input}
          secureTextEntry={secret && hidden}
          style={[s.input, { borderColor: border, borderWidth: error || tone ? 2 : 1, backgroundColor: bg }, secret && { paddingRight: 48 }]}
        />
        {secret && (
          <Pressable onPress={() => setHidden(!hidden)} accessibilityRole="button" accessibilityLabel={hidden ? `Show ${label.toLowerCase()}` : `Hide ${label.toLowerCase()}`}
            style={{ position: 'absolute', right: 4, top: 0, bottom: 0, width: 44, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={hidden ? 'eye-outline' : 'eye-off-outline'} size={20} color={colors.textSecondary} />
          </Pressable>
        )}
      </View>
      {note ? <Text style={[type.caption, { color: noteColor }]}>{note}</Text> : null}
    </View>
  );
}

export function Segmented<K extends string>({ options, value, onChange }: { options: { key: K; label: string }[]; value: K; onChange: (k: K) => void }) {
  return (
    <View style={s.segment} accessibilityRole="tablist">
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable key={o.key} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => onChange(o.key)}
            style={[s.segItem, on && { backgroundColor: colors.strawberryStrong }]}>
            <Text style={[on ? type.captionStrong : type.caption, { color: on ? colors.onAccent : colors.text }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export const Chip = ({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) => (
  <Pressable accessibilityRole="button" accessibilityState={{ selected: on }} onPress={onPress}
    style={[s.chip, on ? { backgroundColor: colors.matchaSoft, borderColor: colors.matcha } : null]}>
    <Text style={[type.captionStrong, { color: on ? colors.matchaStrong : colors.text }]}>{label}</Text>
  </Pressable>
);

/** Square checkbox with its label. The whole row is the touch target. */
export const Checkbox = ({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) => (
  <Pressable onPress={onPress} accessibilityRole="checkbox" accessibilityState={{ checked: on }}
    style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: TOUCH }}>
    <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: on ? colors.strawberryStrong : colors.textSecondary, backgroundColor: on ? colors.strawberryStrong : colors.white, alignItems: 'center', justifyContent: 'center' }}>
      {on && <Icon name="checkmark" size={16} color={colors.onAccent} />}
    </View>
    <Text style={[type.body, { color: colors.text, flex: 1 }]}>{label}</Text>
  </Pressable>
);

export const Empty = ({ icon, title, message, action, onAction }: { icon: IconName; title: string; message: string; action?: string; onAction?: () => void }) => (
  <Card style={{ alignItems: 'center', gap: space.sm, paddingVertical: space.xxl }}>
    <View style={s.emptyIcon}><Icon name={icon} size={32} color={colors.strawberry} /></View>
    <T v="cardTitle" center>{title}</T>
    <T color={colors.textSecondary} center>{message}</T>
    {action && <Button label={action} onPress={onAction} kind="tonal" style={{ marginTop: space.sm }} />}
  </Card>
);

export const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.header, paddingHorizontal: space.sm, height: 60 },
  headerSide: { minWidth: TOUCH, width: 88, justifyContent: 'center' },
  iconBtn: { width: TOUCH, height: TOUCH, alignItems: 'center', justifyContent: 'center' },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: space.xl, paddingBottom: 34, backgroundColor: colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, flexDirection: 'row', gap: space.md },
  btn: { minHeight: TOUCH, borderRadius: radius.button, paddingHorizontal: space.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
  card: { backgroundColor: colors.white, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border, padding: space.lg, gap: space.md },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  banner: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.button, borderWidth: 1 },
  input: { fontFamily: FONT, minHeight: TOUCH, borderRadius: radius.button, paddingHorizontal: space.lg, fontSize: 15, color: colors.text },
  segment: { flexDirection: 'row', backgroundColor: colors.white, borderRadius: radius.pill, padding: 4, gap: 4 },
  segItem: { flex: 1, minHeight: 36, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  chip: { minHeight: 40, minWidth: 44, paddingHorizontal: space.md, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  emptyIcon: { width: 64, height: 64, borderRadius: 20, backgroundColor: colors.header, alignItems: 'center', justifyContent: 'center' },
});

/** ScrollView with pull-down-to-refresh on web: pulling down at the top reloads the app.
 *  The installed app (home screen) has no browser pull-to-refresh, so we add our own. */
function PullScroll({ children }: { children: ReactNode }) {
  const top = useRef(0);
  const startY = useRef<number | null>(null);
  const [pull, setPull] = useState(0);
  const [loading, setLoading] = useState(false);
  const READY = 70;
  if (Platform.OS !== 'web') return <ScrollView keyboardShouldPersistTaps="handled">{children}</ScrollView>;
  return (
    <ScrollView keyboardShouldPersistTaps="handled" scrollEventThrottle={16}
      onScroll={(e) => { top.current = e.nativeEvent.contentOffset.y; }}
      onTouchStart={(e) => { startY.current = top.current <= 0 ? e.nativeEvent.touches[0]?.pageY ?? null : null; }}
      onTouchMove={(e) => { if (startY.current == null) return; const dy = (e.nativeEvent.touches[0]?.pageY ?? 0) - startY.current; setPull(dy > 0 && top.current <= 0 ? Math.min(dy / 2, 100) : 0); }}
      onTouchEnd={() => { startY.current = null; if (pull >= READY) { setLoading(true); setTimeout(() => window.location.reload(), 150); } else setPull(0); }}>
      {(pull > 0 || loading) && (
        <View style={{ height: loading ? READY : pull, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 8 }} accessibilityLiveRegion="polite">
          {loading ? <ActivityIndicator color={colors.strawberryStrong} />
            : <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '600', fontFamily: FONT }}>{pull >= READY ? 'Release to refresh' : 'Pull down to refresh'}</Text>}
        </View>
      )}
      {children}
    </ScrollView>
  );
}
