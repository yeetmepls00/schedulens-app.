// A date picker field. On the web it uses the browser's own date picker.
import { createElement } from 'react';
import { Platform, TextInput, View } from 'react-native';
import { formatTime, parseTime } from '../lib/time';
import { Field, T } from './ui';
import { colors, FONT, radius, space } from '../theme/tokens';

export function DateInput({ value, onChange }: { value: string; onChange: (iso: string) => void }) {
  const style = { width: '100%', boxSizing: 'border-box' as const, fontFamily: FONT, minHeight: 48, borderRadius: radius.button, paddingLeft: space.lg, paddingRight: space.lg, fontSize: 15, color: colors.text, border: `1px solid ${colors.border}`, background: colors.white };
  if (Platform.OS === 'web') {
    return createElement('input', { type: 'date', value, 'aria-label': 'Date', onChange: (e: { target: { value: string } }) => onChange(e.target.value), style });
  }
  return <TextInput value={value} onChangeText={onChange} placeholder="YYYY-MM-DD" accessibilityLabel="Date"
    style={{ fontFamily: FONT, minHeight: 48, borderRadius: radius.button, paddingHorizontal: space.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white }} />;
}

const to24 = (v: string) => { const m = parseTime(v)?.minutes; return m === undefined ? '' : `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };

/**
 * A time field with a picker. Values are kept as text like "9:00 AM" so the
 * rest of the app reads them the same way as before.
 */
export function TimeField({ label, value, onChange, error, tone, onBlur }: {
  label: string; value: string; onChange: (v: string) => void; error?: string; tone?: 'low' | 'missing' | 'edited'; onBlur?: () => void;
}) {
  if (Platform.OS !== 'web') return <Field label={label} value={value} onChangeText={onChange} error={error} tone={tone} onBlur={onBlur} placeholder="9:00 AM" />;
  const border = error || tone === 'missing' ? colors.error : tone === 'low' ? colors.warning : tone === 'edited' ? colors.strawberry : colors.border;
  const note = error ?? (tone === 'low' ? 'Check this: low confidence' : tone === 'missing' ? 'Not found. Please fill in.' : undefined);
  return (
    <View style={{ gap: 6, flex: 1 }}>
      <T v="label">{label}</T>
      {createElement('input', {
        type: 'time', value: to24(value), 'aria-label': label,
        onChange: (e: { target: { value: string } }) => { const [h, m] = e.target.value.split(':').map(Number); if (!isNaN(h)) onChange(formatTime(h * 60 + (m || 0))); },
        onBlur,
        style: { fontFamily: FONT, minHeight: 48, borderRadius: radius.button, paddingLeft: space.lg, paddingRight: space.sm, fontSize: 15, color: colors.text, border: `${error || tone ? 2 : 1}px solid ${border}`, background: colors.white, width: '100%', boxSizing: 'border-box' },
      })}
      {note && <T v="caption" color={error || tone === 'missing' ? colors.error : colors.warning}>{note}</T>}
    </View>
  );
}
