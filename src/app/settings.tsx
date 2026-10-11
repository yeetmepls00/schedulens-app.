// 4.5 Profile & Settings: your name, links to rules and privacy, log out.
import { router } from 'expo-router';
import { useState } from 'react';
import { confirm } from '../lib/confirm';
import { Banner, Button, Card, Field, Screen, T } from '../components/ui';
import { logOut } from '../lib/auth';
import { deleteAllData, getSetting, setSetting } from '../data/db';
import { colors, space } from '../theme/tokens';

export default function Settings() {
  const [name, setName] = useState(getSetting('displayName', ''));
  const [saved, setSaved] = useState(false);
  function save() { setSetting('displayName', name.trim()); setSaved(true); }
  function wipe() {
    confirm('Delete all data?', 'This removes every event, file, and setting from this phone. Groups you joined keep your last shared busy times until you leave them.', [
      { text: 'Delete everything', destructive: true, onPress: () => { deleteAllData(); router.replace('/'); } },
    ]);
  }

  return (
    <Screen title="Profile & Settings" back footer={<Button label="Save" disabled={!name.trim()} onPress={save} />}>
      {saved && <Banner tone="success" title="Saved" message="Your settings were updated." />}
      <Card style={{ gap: space.md }}>
        <T v="cardTitle">Profile</T>
        <Field label="Username" value={name} onChangeText={(v) => { setName(v); setSaved(false); }} helper="Shown to group members." />
      </Card>
      <Button kind="tonal" icon="options-outline" label="Schedule rules" onPress={() => router.push('/rules')} />
      <Button kind="tonal" icon="shield-checkmark-outline" label="Data & privacy" onPress={() => router.push('/privacy')} />
      <Button kind="secondary" icon="log-out-outline" label="Log out" onPress={async () => { await logOut(); router.dismissAll(); router.replace('/login'); }} />
      <T v="caption" color={colors.textSecondary}>You will need to sign in again.</T>
      <Button kind="text" icon="trash" label="Delete all my data" onPress={wipe} />
    </Screen>
  );
}
