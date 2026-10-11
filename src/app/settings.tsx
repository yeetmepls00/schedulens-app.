// Settings: name, term dates, warning rules, and deleting all data.
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { Banner, Button, Card, Field, Screen, T } from '../components/ui';
import { logOut } from '../lib/auth';
import { deleteAllData, getRules, getSetting, setSetting } from '../data/db';
import { colors, space } from '../theme/tokens';

const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(Date.parse(v));
const isNum = (v: string) => /^\d+$/.test(v) && +v > 0;

export default function Settings() {
  const rules = getRules();
  const [name, setName] = useState(getSetting('displayName', ''));
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
    setSetting('displayName', name.trim());
    setSetting('termStart', termStart || null);
    setSetting('termEnd', termEnd || null);
    setSetting('rules', { minTravelMin: +travel, minBreakMin: +brk, maxContinuousMin: +maxRun * 60 });
    setSaved(true);
  }
  function wipe() {
    Alert.alert('Delete all data?', 'This removes every event, file, and setting from this phone. Groups you joined keep your last shared busy times until you leave them.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete everything', style: 'destructive', onPress: () => { deleteAllData(); router.replace('/'); } },
    ]);
  }

  return (
    <Screen title="Settings" back footer={<Button label="Save settings" disabled={!ok} onPress={save} />}>
      {saved && <Banner tone="success" title="Saved" message="Your settings were updated." />}
      <Card style={{ gap: space.md }}>
        <T v="cardTitle">Profile</T>
        <Field label="Display name" value={name} onChangeText={(v) => { setName(v); setSaved(false); }} helper="Shown to group members." />
      </Card>
      <Card style={{ gap: space.md }}>
        <T v="cardTitle">Term dates</T>
        <T v="caption" color={colors.textSecondary}>Used when exporting, so weekly classes stop at the end of term.</T>
        <View style={{ flexDirection: 'row', gap: space.md }}>
          <View style={{ flex: 1 }}><Field label="Start" value={termStart} onChangeText={setTermStart} placeholder="2026-08-10" error={errs.termStart} /></View>
          <View style={{ flex: 1 }}><Field label="End" value={termEnd} onChangeText={setTermEnd} placeholder="2026-12-18" error={errs.termEnd} /></View>
        </View>
      </Card>
      <Card style={{ gap: space.md }}>
        <T v="cardTitle">Warning rules</T>
        <T v="caption" color={colors.textSecondary}>Simple rules, not real travel distance or health advice.</T>
        <Field label="Minimum travel gap (minutes)" value={travel} onChangeText={setTravel} keyboardType="number-pad" error={errs.travel} />
        <Field label="A break is at least (minutes)" value={brk} onChangeText={setBrk} keyboardType="number-pad" error={errs.brk} />
        <Field label="Warn after continuous hours" value={maxRun} onChangeText={setMaxRun} keyboardType="number-pad" error={errs.maxRun} />
      </Card>
      <Button kind="secondary" icon="log-out-outline" label="Log out" onPress={async () => { await logOut(); router.dismissAll(); router.replace('/login'); }} />
      <T v="caption" color={colors.textSecondary}>You will need to sign in again.</T>
      <Button kind="text" icon="trash" label="Delete all my data" onPress={wipe} />
    </Screen>
  );
}
