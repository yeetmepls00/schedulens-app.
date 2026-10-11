// Groups: find shared free time. Only busy blocks (day + start + end) leave the phone.
import { useEffect, useState } from 'react';
import { Share, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Badge, Banner, Button, Card, Chip, Empty, Field, Screen, T } from '../../components/ui';
import { getSetting, setSetting, useEvents } from '../../data/db';
import { findFreeSlots } from '../../lib/freeTime';
import { createGroup, groupsConfigured, joinGroup, leaveGroup, loadMembers, shareBusy, type Group, type MemberBusy } from '../../lib/groups';
import { DAY_SHORT, formatDuration, formatTime } from '../../lib/time';
import type { Weekday } from '../../lib/types';
import { colors, space } from '../../theme/tokens';

export default function Groups() {
  const events = useEvents();
  const [groups, setGroups] = useState<Group[]>(() => getSetting<Group[]>('groups', []));
  const [open, setOpen] = useState<Group | null>(null);
  const [members, setMembers] = useState<MemberBusy[]>([]);
  const [day, setDay] = useState<Weekday>(new Date().getDay() as Weekday);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const displayName = getSetting('displayName', '');

  const save = (g: Group[]) => { setGroups(g); setSetting('groups', g); };
  async function run(fn: () => Promise<void>) {
    setBusy(true); setError(null);
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong. Check your internet connection.'); }
    finally { setBusy(false); }
  }

  useEffect(() => {
    if (!open) return;
    run(async () => setMembers(await loadMembers(open.id)));
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!groupsConfigured) {
    return (
      <Screen title="Groups">
        <Banner tone="neutral" title="Groups are not set up yet" message="Group availability needs a free Supabase project. Follow the README steps, add your keys to a .env file, and restart the app." />
      </Screen>
    );
  }
  if (!displayName) {
    return <Screen title="Groups"><Banner tone="warning" title="Add your name first" message="Set a display name in Settings so group members know who you are." /></Screen>;
  }

  if (open) {
    const slots = findFreeSlots(members.map((m) => m.blocks), day);
    return (
      <Screen title={open.name} back={false} right={<Button kind="text" label="Close" onPress={() => setOpen(null)} />}>
        <Banner tone="matcha" title="Private by design" message="Members see only when you are busy, never what your events are." />
        {error && <Banner tone="error" title="Could not load" message={error} />}
        <Card style={{ alignItems: 'center', gap: space.sm }}>
          <QRCode value={open.code} size={140} color={colors.text} />
          <T v="section">{open.code}</T>
          <T v="caption" color={colors.textSecondary}>Invite expires {new Date(open.expiresAt).toLocaleDateString()}</T>
          <Button kind="secondary" label="Share invite code" icon="share-social" onPress={() => Share.share({ message: `Join my ScheduLens group with code ${open.code}` })} />
        </Card>
        <T v="section">{members.length} {members.length === 1 ? 'member' : 'members'}</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{members.map((m) => <Badge key={m.userId} tone="neutral" label={m.displayName} />)}</View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {DAY_SHORT.map((d, w) => <Chip key={d} label={d} on={day === w} onPress={() => setDay(w as Weekday)} />)}
        </View>
        {slots.length === 0 ? <Empty icon="time-outline" title="No common free time" message="Everyone is busy between 7 AM and 9 PM on this day, or gaps are under 30 minutes." /> :
          slots.map((sl, i) => (
            <Card key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <T v="cardTitle">{formatTime(sl.startMin)} – {formatTime(sl.endMin)}</T>
              <Badge tone="success" label={formatDuration(sl.endMin - sl.startMin)} />
            </Card>
          ))}
        <Button kind="tonal" label="Update my busy times" icon="refresh" loading={busy} onPress={() => run(async () => { await shareBusy(open.id, events); setMembers(await loadMembers(open.id)); })} />
        <Button kind="text" label="Leave group" icon="exit" onPress={() => run(async () => { await leaveGroup(open.id); save(groups.filter((g) => g.id !== open.id)); setOpen(null); })} />
      </Screen>
    );
  }

  return (
    <Screen title="Groups">
      <T color={colors.textSecondary}>Create or join a group to see when everyone is free. Only your busy times are shared, never event names, rooms, or instructors.</T>
      {error && <Banner tone="error" title="Could not finish" message={error} />}
      {groups.map((g) => (
        <Card key={g.id}><Button kind="text" label={g.name} icon="people" onPress={() => setOpen(g)} /></Card>
      ))}
      <Card style={{ gap: space.md }}>
        <T v="cardTitle">Create a group</T>
        <Field label="Group name" value={name} onChangeText={setName} placeholder="e.g. Thesis team" />
        <Button label="Create" loading={busy} disabled={!name.trim()} onPress={() => run(async () => { const g = await createGroup(name.trim(), displayName, events); save([...groups, g]); setName(''); setOpen(g); })} />
      </Card>
      <Card style={{ gap: space.md }}>
        <T v="cardTitle">Join with a code</T>
        <Field label="Invite code" value={code} onChangeText={setCode} autoCapitalize="characters" />
        <Button kind="secondary" label="Join" loading={busy} disabled={!code.trim()} onPress={() => run(async () => { const g = await joinGroup(code, displayName, events); save([...groups.filter((x) => x.id !== g.id), g]); setCode(''); setOpen(g); })} />
      </Card>
    </Screen>
  );
}
