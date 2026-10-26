// 4.5 Profile & Settings: account, alerts, calendar, data, and about. Changes save as you make them.
import { router } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { Platform, Pressable, Switch, View } from 'react-native';
import { Avatar, getAvatar, pickAvatar, removeAvatar } from '../components/avatar';
import { InstallApp } from '../components/install-app';
import { Banner, Button, Card, Chip, Field, Icon, type IconName, Screen, T } from '../components/ui';
import { deleteAllData, exportBackup, importBackup, getAlerts, getRules, getSetting, setSetting, type AlertKinds } from '../data/db';
import { deleteAccount, logOut, sendPasswordReset } from '../lib/auth';
import { confirm } from '../lib/confirm';
import { sb } from '../lib/groups';
import type { IssueRules } from '../lib/conflicts';
import { colors, radius, space } from '../theme/tokens';

const VIEWS = [['day', 'Day'], ['week', 'Week'], ['month', 'Month'], ['list', 'List'], ['heatmap', 'Heatmap']] as const;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ gap: space.sm }}>
      <T v="captionStrong" color={colors.textSecondary}>{title.toUpperCase()}</T>
      <Card style={{ paddingVertical: 0 }}>{children}</Card>
    </View>
  );
}
function RowBase({ icon, label, sub, right, onPress, last, danger }: { icon: IconName; label: string; sub?: string; right?: ReactNode; onPress?: () => void; last?: boolean; danger?: boolean }) {
  const body = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, borderBottomWidth: last ? 0 : 1, borderColor: colors.border }}>
      <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: danger ? colors.errorSurface : colors.header, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} color={danger ? colors.error : colors.strawberryStrong} size={18} />
      </View>
      <View style={{ flex: 1 }}>
        <T v="captionStrong" color={danger ? colors.error : colors.text}>{label}</T>
        {sub ? <T v="caption" color={colors.textSecondary}>{sub}</T> : null}
      </View>
      {right ?? (onPress ? <Icon name="chevron-forward" color={colors.textSecondary} size={18} /> : null)}
    </View>
  );
  return onPress ? <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>{body}</Pressable> : body;
}
function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return <Switch value={value} onValueChange={onChange} accessibilityLabel={label}
    trackColor={{ false: colors.disabled, true: colors.strawberryStrong }} thumbColor={colors.white} {...({ activeThumbColor: colors.white } as object)} />;
}
function Stepper({ value, unit, step, min, max, onChange, label }: { value: number; unit: string; step: number; min: number; max: number; onChange: (v: number) => void; label: string }) {
  const btn = (d: number, icon: IconName, name: string) => (
    <Pressable onPress={() => onChange(Math.min(max, Math.max(min, value + d)))} disabled={value + d < min || value + d > max} accessibilityRole="button" accessibilityLabel={`${name} ${label}`} hitSlop={6}
      style={{ width: 32, height: 32, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', opacity: value + d < min || value + d > max ? 0.4 : 1 }}>
      <Icon name={icon} size={16} color={colors.strawberryStrong} />
    </Pressable>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
      {btn(-step, 'remove', 'Decrease')}
      <T v="captionStrong" style={{ minWidth: 56, textAlign: 'center' }}>{value} {unit}</T>
      {btn(step, 'add', 'Increase')}
    </View>
  );
}

export default function Settings() {
  const [name, setName] = useState(getSetting('displayName', ''));
  const [editing, setEditing] = useState(false);
  const [email, setEmail] = useState('');
  const [, refresh] = useState(0);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; title: string; message: string } | null>(null);
  const [alerts, setAlertsState] = useState<AlertKinds>(getAlerts);
  const [rules, setRulesState] = useState<IssueRules>(getRules);
  const [view, setView] = useState(getSetting<string>('defaultView', 'day'));

  useEffect(() => { sb().auth.getSession().then(({ data }) => setEmail(data.session?.user.email ?? '')).catch(() => {}); }, []);

  const saveAlerts = (a: AlertKinds) => { setAlertsState(a); setSetting('alerts', a); };
  const saveRules = (r: IssueRules) => { setRulesState(r); setSetting('rules', r); };
  const say = (tone: 'success' | 'error', title: string, message: string) => setNotice({ tone, title, message });

  function saveName() { if (!name.trim()) return; setSetting('displayName', name.trim()); setEditing(false); say('success', 'Saved', 'Your name was updated.'); }
  async function photo() { try { if (await pickAvatar()) refresh((n) => n + 1); } catch (e) { say('error', 'Photo not added', e instanceof Error ? e.message : 'Could not use that photo.'); } }
  async function changePassword() {
    if (!email) return;
    try { await sendPasswordReset(email); say('success', 'Check your email', `We sent a link to ${email} to set a new password.`); }
    catch (e) { say('error', 'Could not send the link', e instanceof Error ? e.message : 'Try again.'); }
  }
  function saveBackup() {
    const blob = new Blob([exportBackup()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `schedulens-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    say('success', 'Backup saved', 'Open ScheduLens where you want your schedule, then tap Restore from backup and pick this file.');
  }
  function restoreBackup() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const text = await file.text();
      confirm('Restore this backup?', 'Your events and files on this device will be replaced with the ones in the backup.', [
        { text: 'Restore', onPress: () => {
          try { const n = importBackup(text); say('success', 'Restored', `${n} ${n === 1 ? 'event' : 'events'} restored.`); }
          catch (e) { say('error', 'Could not restore', e instanceof Error ? e.message : 'The file could not be read.'); }
        } },
      ]);
    };
    input.click();
  }
  function wipe() {
    confirm('Delete data on this device?', 'This removes every event and imported file from this device. Your account stays.', [
      { text: 'Delete data', destructive: true, onPress: () => { deleteAllData(); say('success', 'Deleted', 'Your events and files were removed from this device.'); } },
    ]);
  }
  function removeAccount() {
    confirm('Delete your account?', 'This deletes your account, leaves your groups, and removes your data from this device. This cannot be undone.', [
      { text: 'Delete account', destructive: true, onPress: async () => {
        try { await deleteAccount(); router.dismissAll(); router.replace('/welcome'); }
        catch (e) { say('error', 'Account not deleted', e instanceof Error ? e.message : 'Try again.'); }
      } },
    ]);
  }

  return (
    <Screen title="Settings" back>
      {notice && <Banner tone={notice.tone} title={notice.title} message={notice.message} />}

      <Card style={{ gap: space.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <Pressable onPress={photo} accessibilityRole="button" accessibilityLabel="Change profile photo">
            <Avatar size={64} name={getSetting('displayName', '')} />
            <View style={{ position: 'absolute', right: -2, bottom: -2, width: 24, height: 24, borderRadius: 12, backgroundColor: colors.strawberryStrong, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.white }}>
              <Icon name="camera" size={12} color={colors.white} />
            </View>
          </Pressable>
          <View style={{ flex: 1 }}>
            <T v="cardTitle">{getSetting('displayName', '') || 'Add your name'}</T>
            <T v="caption" color={colors.textSecondary}>{email || 'Signed in'}</T>
          </View>
        </View>
        {editing ? (
          <>
            <Field label="Display name" value={name} onChangeText={setName} helper="Shown to group members." />
            <View style={{ flexDirection: 'row', gap: space.md }}>
              <Button kind="secondary" label="Cancel" style={{ flex: 1 }} onPress={() => { setName(getSetting('displayName', '')); setEditing(false); }} />
              <Button label="Save" style={{ flex: 1 }} disabled={!name.trim()} onPress={saveName} />
            </View>
          </>
        ) : (
          <View style={{ flexDirection: 'row', gap: space.md }}>
            <Button kind="tonal" icon="create-outline" label="Edit name" style={{ flex: 1 }} onPress={() => setEditing(true)} />
            <Button kind="secondary" icon="image-outline" label={getAvatar() ? 'Photo' : 'Add photo'} style={{ flex: 1 }} onPress={photo} />
          </View>
        )}
        {!!getAvatar() && <Button kind="text" label="Remove photo" onPress={() => { removeAvatar(); refresh((n) => n + 1); }} />}
      </Card>

      <InstallApp hideWhenInstalled />

      <Section title="Alerts">
        <RowBase icon="close-circle-outline" label="Overlap warnings" sub="When two events happen at the same time"
          right={<Toggle label="Overlap warnings" value={alerts.overlap} onChange={(v) => saveAlerts({ ...alerts, overlap: v })} />} />
        <RowBase icon="walk-outline" label="Travel time warnings" sub="When the gap between events is short"
          right={<Toggle label="Travel time warnings" value={alerts.travel} onChange={(v) => saveAlerts({ ...alerts, travel: v })} />} />
        {alerts.travel && <RowBase icon="time-outline" label="Minimum gap" right={<Stepper label="minimum gap" value={rules.minTravelMin} unit="min" step={5} min={5} max={60} onChange={(v) => saveRules({ ...rules, minTravelMin: v })} />} />}
        <RowBase icon="barbell-outline" label="Long day warnings" sub="When classes run back to back too long" last={!alerts.workload}
          right={<Toggle label="Long day warnings" value={alerts.workload} onChange={(v) => saveAlerts({ ...alerts, workload: v })} />} />
        {alerts.workload && <RowBase icon="hourglass-outline" label="Warn after" last right={<Stepper label="hours before warning" value={rules.maxContinuousMin / 60} unit="h" step={1} min={2} max={10} onChange={(v) => saveRules({ ...rules, maxContinuousMin: v * 60 })} />} />}
      </Section>

      <Section title="Calendar">
        <View style={{ paddingVertical: space.md, gap: space.sm, borderBottomWidth: 1, borderColor: colors.border }}>
          <T v="captionStrong">Open the calendar in</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {VIEWS.map(([id, label]) => <Chip key={id} label={label} on={view === id} onPress={() => { setView(id); setSetting('defaultView', id); }} />)}
          </View>
        </View>
        <RowBase icon="color-palette-outline" label="Timetable design" sub="Presets, colors, and layout" onPress={() => router.push('/timetable')} />
        <RowBase icon="calendar-outline" label="Term dates" sub="Used when exporting to other calendars" onPress={() => router.push('/rules')} last />
      </Section>

      <Section title="Account & security">
        <RowBase icon="mail-outline" label="Email" sub={email || '—'} />
        <RowBase icon="key-outline" label="Change password" sub="We email you a secure link" onPress={changePassword} />
        <RowBase icon="log-out-outline" label="Log out" sub="You will need to sign in again" last
          onPress={async () => { await logOut(); router.dismissAll(); router.replace('/login'); }} />
      </Section>

      <Section title="Data & privacy">
        <RowBase icon="shield-checkmark-outline" label="Privacy" sub="What is shared and what stays on your device" onPress={() => router.push('/privacy')} />
        <RowBase icon="download-outline" label="Export my schedule" sub="Download an .ics file from the Vault" onPress={() => router.push('/vault')} />
        {Platform.OS === 'web' && <>
          <RowBase icon="cloud-download-outline" label="Save backup file" sub="Move your schedule from the browser to the app, or to another device" onPress={saveBackup} />
          <RowBase icon="cloud-upload-outline" label="Restore from backup" sub="Open a backup file saved from ScheduLens" onPress={restoreBackup} />
        </>}
        <RowBase icon="trash-outline" label="Delete data on this device" danger onPress={wipe} />
        <RowBase icon="person-remove-outline" label="Delete account" danger last onPress={removeAccount} />
      </Section>

      <Section title="About">
        <RowBase icon="help-circle-outline" label="Help & user manual" onPress={() => router.push('/help')} />
        <RowBase icon="information-circle-outline" label="Version" right={<T v="caption" color={colors.textSecondary}>1.0.0</T>} last />
      </Section>
    </Screen>
  );
}
