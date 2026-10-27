// 4.7 Schedule rules: term dates and the warning rules used by the conflict checks.
import { useState } from 'react';
import { DateInput, TimeField } from '../components/date-input';
import { View } from 'react-native';
import { Banner, Button, Card, Field, Screen, T } from '../components/ui';
import { getRules, getSetting, setSetting } from '../data/db';
import { colors, space } from '../theme/tokens';

const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(Date.parse(v));
const isNum = (v: string) => /^\d+$/.test(v) && +v > 0;

export default function Rules() {
  const rules = getRules();
  const [termStart, setTermStart] = useState(getSetting('termStart', '') ?? '');
  const [termEnd, setTermEnd] = useState(getSetting('termEnd', '') ?? '');
  const [travel, setTravel] = useState(String(rules.minTravelMin));
  const [brk, setBrk] = useState(String(rules.minBreakMin));
  const [maxRun, setMaxRun] = useState(String(rules.maxContinuousMin / 60));
  const [saved, setSaved] = useState(false);

  const errs = {
    termStart: termStart && !isDate(termStart) ? 'Use YYYY-MM-DD' : undefined,
    termEnd: termEnd && !isDate(termEnd) ? 'Use YYYY-MM-DD' : termStart && termEnd && termEnd <= termStart ? 'Must be after the start' : undefined,
    travel: isNum(travel) ? undefined : 'Enter minutes', brk: isNum(brk) ? undefined : 'Enter minutes', maxRun: isNum(maxRun) ? undefined : 'Enter hours',
  };
  const ok = Object.values(errs).every((e) => !e);

  function save() {
    setSetting('termStart', termStart || null);
    setSetting('termEnd', termEnd || null);
    setSetting('rules', { minTravelMin: +travel, minBreakMin: +brk, maxContinuousMin: +maxRun * 60 });
    setSaved(true);
  }
  return (
    <Screen title="Schedule rules" back footer={<Button label="Save settings" disabled={!ok} onPress={save} />}>
      {saved && <Banner tone="success" title="Saved" message="Your settings were updated." />}
      <Card style={{ gap: space.md }}>
        <T v="cardTitle">Term dates</T>
        <T v="caption" color={colors.textSecondary}>Used when exporting, so weekly events stop at the end of term.</T>
        <View style={{ flexDirection: 'row', gap: space.md }}>
          <View style={{ flex: 1 }}><T v="label">Start</T><DateInput value={termStart} onChange={setTermStart} />{errs.termStart ? <T v="caption" color={colors.error}>{errs.termStart}</T> : null}</View>
          <View style={{ flex: 1 }}><T v="label">End</T><DateInput value={termEnd} onChange={setTermEnd} />{errs.termEnd ? <T v="caption" color={colors.error}>{errs.termEnd}</T> : null}</View>
        </View>
      </Card>
      <Card style={{ gap: space.md }}>
        <T v="cardTitle">Warning rules</T>
        <T v="caption" color={colors.textSecondary}>Simple rules, not real travel distance or health advice.</T>
        <Field label="Minimum travel gap (minutes)" value={travel} onChangeText={setTravel} keyboardType="number-pad" error={errs.travel} />
        <Field label="A break is at least (minutes)" value={brk} onChangeText={setBrk} keyboardType="number-pad" error={errs.brk} />
        <Field label="Warn after continuous hours" value={maxRun} onChangeText={setMaxRun} keyboardType="number-pad" error={errs.maxRun} />
      </Card>
    </Screen>
  );
}
