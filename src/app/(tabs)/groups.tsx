// Groups: find shared free time. Only busy blocks (day + start + end) leave the phone.
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { QrScanner } from '../../components/qr-scanner';
import { APP_URL, codeFromQr, readQrFromImage, shareApp } from '../../lib/qr';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { Badge, Banner, Button, Card, Chip, Empty, Field, Screen, T } from '../../components/ui';
import { getSetting, useEvents } from '../../data/db';
import { findFreeSlots } from '../../lib/freeTime';
import { loadGroupInfo, setGroupDescription } from '../../lib/groups';
import { addActivity, createGroup, deleteActivity, groupsConfigured, leaveGroup, loadActivities, loadMembers, nextDateFor, saveGroups, savedGroups, shareBusy, type Activity, type Group, type MemberBusy } from '../../lib/groups';
import { DAY_SHORT, formatDuration, formatTime, parseTime } from '../../lib/time';
import type { Weekday } from '../../lib/types';
import { colors, space } from '../../theme/tokens';

export default function Groups() {
  const events = useEvents();
  const [groups, setGroups] = useState<Group[]>(savedGroups);
  const params = useLocalSearchParams<{ open?: string }>();
  const [open, setOpen] = useState<Group | null>(null);
  const [members, setMembers] = useState<MemberBusy[]>([]);
  const [day, setDay] = useState<Weekday>(new Date().getDay() as Weekday);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [scanning, setScanning] = useState(false);
  const [qrError, setQrError] = useState('');
  const [inviteNote, setInviteNote] = useState('');
  function joinFromQr(text: string | null) {
    const c = text ? codeFromQr(text) : null;
    if (!c) { setQrError(text ? 'That QR code is not a ScheduLens group code.' : 'No QR code found in that picture. Try a clearer one.'); return; }
    setQrError('');
    router.push({ pathname: '/join', params: { code: c } });
  }
  async function uploadQr() {
    setQrError('');
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    if (r.canceled || !r.assets?.[0]) return;
    try { joinFromQr(await readQrFromImage(r.assets[0].uri)); } catch (e) { setQrError(e instanceof Error ? e.message : 'Could not read that picture.'); }
  }
  async function inviteFriends() {
    try { setInviteNote((await shareApp()) === 'copied' ? 'Link copied. Paste it in a chat.' : ''); } catch { setInviteNote('Share this link: ' + APP_URL); }
  }
  const [busy, setBusy] = useState(false);
  const [desc, setDesc] = useState('');
  const [info, setInfo] = useState<{ description: string; isOwner: boolean } | null>(null);
  const [editDesc, setEditDesc] = useState<string | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [plan, setPlan] = useState<{ title: string; day: string; start: string; end: string; place: string } | null>(null);
  const [planErr, setPlanErr] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const displayName = getSetting('displayName', '');

  const save = (g: Group[]) => { setGroups(g); saveGroups(g); };
  // Coming back from 4.3 Join Group: reload the list and open the joined group.
  useFocusEffect(useCallback(() => {
    const list = savedGroups();
    setGroups(list);
    if (params.open) { const g = list.find((x) => x.id === params.open); if (g) setOpen(g); router.setParams({ open: undefined }); }
  }, [params.open]));
  async function run(fn: () => Promise<void>) {
    setBusy(true); setError(null);
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong. Check your internet connection.'); }
    finally { setBusy(false); }
  }

  useEffect(() => {
    if (!open) return;
    setInfo(null); setEditDesc(null);
    run(async () => { setMembers(await loadMembers(open.id)); setActivities(await loadActivities(open.id)); setInfo(await loadGroupInfo(open.id).catch(() => ({ description: '', isOwner: false }))); });
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
        {error && <Banner tone="error" title="Could not load" message={error} />}
        <LinearGradient colors={['#FFE3E8', '#FFF6EE', '#E9F3DC']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 22, padding: space.lg, gap: space.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' }}><T style={{ fontSize: 26 }}>👥</T></View>
            <View style={{ flex: 1 }}>
              <T v="section">{open.name}</T>
              <T v="caption" color={colors.textSecondary}>{members.length} {members.length === 1 ? 'member' : 'members'}</T>
            </View>
          </View>
          {editDesc !== null ? (
            <>
              <Field label="Description (optional)" value={editDesc} onChangeText={(v) => setEditDesc(v.slice(0, 200))} placeholder="e.g. Our thesis group for 4th year" />
              <View style={{ flexDirection: 'row', gap: space.md }}>
                <Button kind="secondary" label="Cancel" style={{ flex: 1 }} onPress={() => setEditDesc(null)} />
                <Button label="Save" style={{ flex: 1 }} loading={busy} onPress={() => run(async () => { await setGroupDescription(open.id, editDesc); setInfo({ description: editDesc.trim(), isOwner: true }); setEditDesc(null); })} />
              </View>
            </>
          ) : info?.description ? (
            <T>{info.description}</T>
          ) : info?.isOwner ? <T v="caption" color={colors.textSecondary}>No description yet.</T> : null}
          {info?.isOwner && editDesc === null && <Button kind="text" icon="create-outline" label={info.description ? 'Edit description' : 'Add description'} style={{ alignSelf: 'flex-start' }} onPress={() => setEditDesc(info.description)} />}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {members.map((m) => (
              <View key={m.userId} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.white, borderRadius: 999, paddingVertical: 4, paddingLeft: 4, paddingRight: 10 }}>
                <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: colors.strawberrySoft, alignItems: 'center', justifyContent: 'center' }}><T v="captionStrong" color={colors.strawberryStrong}>{(m.displayName || '?')[0].toUpperCase()}</T></View>
                <T v="captionStrong">{m.displayName}</T>
              </View>
            ))}
          </View>
          <Button kind="secondary" label="Invite" icon="person-add-outline"
            onPress={() => router.push({ pathname: '/invite', params: { name: open.name, code: open.code, expiresAt: open.expiresAt } })} />
        </LinearGradient>
        <Banner tone="matcha" title="Private by design" message="Members see only when you are busy, never what your events are." />
        <T v="section">Group activities</T>
        <T v="caption" color={colors.textSecondary}>Set a date for a meeting or activity. Everyone in the group can see it.</T>
        {activities.length === 0 && !plan && <Empty icon="calendar-outline" title="Nothing planned yet" message="Pick a free time below and tap Plan, or add one yourself." />}
        {activities.map((a) => (
          <Card key={a.id} style={{ gap: 4 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <T v="cardTitle" style={{ flex: 1 }}>{a.title}</T>
              {a.mine && <Button kind="text" label="Remove" onPress={() => run(async () => { await deleteActivity(a.id); setActivities(await loadActivities(open.id)); })} />}
            </View>
            <T>{new Date(a.day + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })} · {formatTime(a.startMin)} – {formatTime(a.endMin)}</T>
            <T v="caption" color={colors.textSecondary}>{a.place ? `${a.place} · ` : ''}Added by {a.by || 'a member'}</T>
          </Card>
        ))}
        {plan ? (
          <Card style={{ gap: space.md }}>
            <T v="cardTitle">Plan an activity</T>
            {planErr && <Banner tone="error" title="Check the details" message={planErr} />}
            <Field label="What" value={plan.title} onChangeText={(v) => setPlan({ ...plan, title: v })} placeholder="e.g. Thesis meeting" />
            <Field label="Date (YYYY-MM-DD)" value={plan.day} onChangeText={(v) => setPlan({ ...plan, day: v })} />
            <View style={{ flexDirection: 'row', gap: space.md }}>
              <View style={{ flex: 1 }}><Field label="Start" value={plan.start} onChangeText={(v) => setPlan({ ...plan, start: v })} /></View>
              <View style={{ flex: 1 }}><Field label="End" value={plan.end} onChangeText={(v) => setPlan({ ...plan, end: v })} /></View>
            </View>
            <Field label="Place (optional)" value={plan.place} onChangeText={(v) => setPlan({ ...plan, place: v })} placeholder="e.g. Library" />
            <View style={{ flexDirection: 'row', gap: space.md }}>
              <Button kind="secondary" label="Cancel" style={{ flex: 1 }} onPress={() => setPlan(null)} />
              <Button label="Share with group" style={{ flex: 1 }} loading={busy} onPress={() => {
                const st = parseTime(plan.start)?.minutes, en = parseTime(plan.end)?.minutes;
                const d = /^\d{4}-\d{2}-\d{2}$/.test(plan.day) ? new Date(plan.day + 'T00:00:00') : null;
                const today = new Date(); today.setHours(0, 0, 0, 0);
                const err = !plan.title.trim() ? 'Add a name for the activity.'
                  : !d || isNaN(d.getTime()) ? 'Enter the date like 2026-11-03.'
                  : d < today ? 'Pick today or a later date.'
                  : st === undefined || en === undefined ? 'Enter times like 3:00 PM.'
                  : en <= st ? 'The end time must be after the start time.' : null;
                if (err) { setPlanErr(err); return; }
                run(async () => { await addActivity(open.id, { title: plan.title, day: plan.day, startMin: st!, endMin: en!, place: plan.place }, displayName); setPlan(null); setActivities(await loadActivities(open.id)); });
              }} />
            </View>
          </Card>
        ) : (
          <Button kind="tonal" icon="add" label="Plan an activity" onPress={() => { setPlanErr(null); setPlan({ title: '', day: nextDateFor(day), start: '3:00 PM', end: '4:00 PM', place: '' }); }} />
        )}
        <T v="section">Free time</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {DAY_SHORT.map((d, w) => <Chip key={d} label={d} on={day === w} onPress={() => setDay(w as Weekday)} />)}
        </View>
        {slots.length === 0 ? <Empty icon="time-outline" title="No common free time" message="Everyone is busy between 7 AM and 9 PM on this day, or gaps are under 30 minutes." /> :
          slots.map((sl, i) => (
            <Card key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <T v="cardTitle">{formatTime(sl.startMin)} – {formatTime(sl.endMin)}</T>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                <Badge tone="success" label={formatDuration(sl.endMin - sl.startMin)} />
                <Button kind="text" label="Plan" onPress={() => { setPlanErr(null); setPlan({ title: '', day: nextDateFor(day), start: formatTime(sl.startMin), end: formatTime(Math.min(sl.endMin, sl.startMin + 60)), place: '' }); }} />
              </View>
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
        <Field label="Description (optional)" value={desc} onChangeText={(v) => setDesc(v.slice(0, 200))} placeholder="e.g. Our thesis group for 4th year" />
        <Button label="Create" loading={busy} disabled={!name.trim()} onPress={() => run(async () => { const g = await createGroup(name.trim(), displayName, events); if (desc.trim()) await setGroupDescription(g.id, desc); save([...groups, g]); setName(''); setDesc(''); setOpen(g); })} />
      </Card>
      <Card style={{ gap: space.md }}>
        <T v="cardTitle">Join a group</T>
        <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'flex-end' }}>
          <View style={{ flex: 1 }}><Field label="Invite code" value={code} onChangeText={setCode} autoCapitalize="characters" placeholder="e.g. AB12CD" /></View>
          <Button label="Join" loading={busy} disabled={!code.trim()} onPress={() => { router.push({ pathname: '/join', params: { code: code.trim().toUpperCase() } }); setCode(''); }} />
        </View>
        {Platform.OS === 'web' && (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
              <T v="caption" color={colors.textSecondary}>or use a QR code</T>
              <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
            </View>
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <Button kind="tonal" icon="scan-outline" label="Scan" style={{ flex: 1 }} onPress={() => { setQrError(''); setScanning(true); }} />
              <Button kind="tonal" icon="image-outline" label="From photo" style={{ flex: 1 }} onPress={uploadQr} />
            </View>
          </>
        )}
        {qrError ? <Badge tone="error" label={qrError} /> : null}
      </Card>
      <Card style={{ gap: space.sm, alignItems: 'center' }}>
        <T v="cardTitle" center>Invite friends to ScheduLens 💌</T>
        <T v="caption" color={colors.textSecondary} center>Send them the app link so they can join your groups too.</T>
        <Button icon="share-social-outline" label="Invite friends" onPress={inviteFriends} />
        {inviteNote ? <Badge tone="success" label={inviteNote} /> : null}
      </Card>
      <QrScanner open={scanning} onClose={() => setScanning(false)} onResult={(t) => { setScanning(false); joinFromQr(t); }} />
    </Screen>
  );
}
