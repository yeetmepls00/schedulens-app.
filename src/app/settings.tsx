// 4.5 Profile & Settings: your name, install, schedule tools, account.
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { confirm } from '../lib/confirm';
import { Avatar, getAvatar, pickAvatar, removeAvatar } from '../components/avatar';
import { InstallApp } from '../components/install-app';
import { Banner, Button, Card, Field, Icon, type IconName, Screen, T } from '../components/ui';
import { logOut } from '../lib/auth';
import { deleteAllData, getSetting, setSetting } from '../data/db';
import { colors, radius, space } from '../theme/tokens';

function Row({ icon, label, sub, onPress, last }: { icon: IconName; label: string; sub: string; onPress: () => void; last?: boolean }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label}
      style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, borderBottomWidth: last ? 0 : 1, borderColor: colors.border }}>
      <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.header, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} color={colors.strawberryStrong} size={20} />
      </View>
      <View style={{ flex: 1 }}>
        <T v="captionStrong">{label}</T>
        <T v="caption" color={colors.textSecondary}>{sub}</T>
      </View>
      <Icon name="chevron-forward" color={colors.textSecondary} size={20} />
    </Pressable>
  );
}

export default function Settings() {
  const [name, setName] = useState(getSetting('displayName', ''));
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [, setPhotoTick] = useState(0);
  const [photoErr, setPhotoErr] = useState<string | null>(null);
  function save() { setSetting('displayName', name.trim()); setSaved(true); setEditing(false); }
  function wipe() {
    confirm('Delete all data?', 'This removes every event and imported file from this device. Groups you joined keep your last shared busy times until you leave them.', [
      { text: 'Delete everything', destructive: true, onPress: () => { deleteAllData(); router.replace('/'); } },
    ]);
  }

  return (
    <Screen title="Profile & Settings" back>
      {saved && <Banner tone="success" title="Saved" message="Your name was updated." />}
      <Card style={{ gap: space.md }}>
        <Pressable onPress={() => setEditing(!editing)} accessibilityRole="button" accessibilityLabel="Edit your name"
          style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <Avatar size={56} name={getSetting('displayName', '')} />
          <View style={{ flex: 1 }}>
            <T v="cardTitle">{getSetting('displayName', '') || 'Add your name'}</T>
            <T v="caption" color={colors.textSecondary}>Shown to group members · Tap to edit</T>
          </View>
          <Icon name={editing ? 'chevron-up' : 'create-outline'} color={colors.textSecondary} size={20} />
        </Pressable>
        <View style={{ flexDirection: 'row', gap: space.md }}>
          <Button kind="tonal" icon="image-outline" label={getAvatar() ? 'Change' : 'Add photo'} style={{ flex: 1 }}
            onPress={async () => { setPhotoErr(null); try { if (await pickAvatar()) setPhotoTick((n) => n + 1); } catch (e) { setPhotoErr(e instanceof Error ? e.message : 'Could not use that photo.'); } }} />
          {!!getAvatar() && <Button kind="secondary" label="Remove" style={{ flex: 1 }} onPress={() => { removeAvatar(); setPhotoTick((n) => n + 1); }} />}
        </View>
        {photoErr && <Banner tone="error" title="Photo not added" message={photoErr} />}
        <T v="caption" color={colors.textSecondary}>Your photo stays on this device and is not shared with groups.</T>
        {editing && (
          <>
            <Field label="Username" value={name} onChangeText={(v) => { setName(v); setSaved(false); }} />
            <Button label="Save name" disabled={!name.trim()} onPress={save} />
          </>
        )}
      </Card>

      <InstallApp />

      <T v="captionStrong" color={colors.textSecondary}>Schedule</T>
      <Card style={{ paddingVertical: 0 }}>
        <Row icon="checkmark-done" label="Schedule check" sub="Overlaps, travel gaps, long days" onPress={() => router.push('/review')} />
        <Row icon="options-outline" label="Schedule rules" sub="Term dates and warning limits" onPress={() => router.push('/rules')} />
        <Row icon="color-palette-outline" label="Timetable editor" sub="Designs, colors, and classes" onPress={() => router.push('/timetable')} />
        <Row icon="notifications-outline" label="Notifications" sub="Today’s warnings" onPress={() => router.push('/notifications')} last />
      </Card>

      <T v="captionStrong" color={colors.textSecondary}>Account</T>
      <Card style={{ paddingVertical: 0 }}>
        <Row icon="shield-checkmark-outline" label="Data & privacy" sub="What is shared, export, delete" onPress={() => router.push('/privacy')} />
        <Row icon="help-circle-outline" label="Help & user manual" sub="How to use ScheduLens" onPress={() => router.push('/help')} last />
      </Card>

      <Button kind="secondary" icon="log-out-outline" label="Log out" onPress={async () => { await logOut(); router.dismissAll(); router.replace('/login'); }} />
      <T v="caption" color={colors.textSecondary}>You will need to sign in again.</T>
      <Button kind="text" icon="trash" label="Delete all my data" onPress={wipe} />
    </Screen>
  );
}
