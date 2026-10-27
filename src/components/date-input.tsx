// A date picker field. On the web it uses the browser's own date picker.
import { createElement } from 'react';
import { Platform, TextInput } from 'react-native';
import { colors, FONT, radius, space } from '../theme/tokens';

export function DateInput({ value, onChange }: { value: string; onChange: (iso: string) => void }) {
  const style = { fontFamily: FONT, minHeight: 48, borderRadius: radius.button, paddingLeft: space.lg, paddingRight: space.lg, fontSize: 15, color: colors.text, border: `1px solid ${colors.border}`, background: colors.white };
  if (Platform.OS === 'web') {
    return createElement('input', { type: 'date', value, 'aria-label': 'Date', onChange: (e: { target: { value: string } }) => onChange(e.target.value), style });
  }
  return <TextInput value={value} onChangeText={onChange} placeholder="YYYY-MM-DD" accessibilityLabel="Date"
    style={{ fontFamily: FONT, minHeight: 48, borderRadius: radius.button, paddingHorizontal: space.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white }} />;
}
