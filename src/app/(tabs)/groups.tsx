// Groups: find shared free time. Only busy blocks (day + start + end) leave the phone.
import { LinearGradient } from 'expo-linear-gradient';
import { InviteAppCard } from '../../components/invite-app';
import * as ImagePicker from 'expo-image-picker';
import { QrScanner } from '../../components/qr-scanner';
import { codeFromQr, readQrFromImage } from '../../lib/qr';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState, useMemo } from 'react';
import { Image, Modal, Platform, Pressable, ScrollView, View } from 'react-native';
import { DayOverlay, freeWindows } from '../../components/busy-overlay';
import { GroupCalendar, activityOn } from '../../components/group-calendar';
import { MEMBER_COLORS, assignColors } from '../../lib/member-colors';
import { Badge, Banner, Button, Card, Chip, Empty, Field, Icon, Screen, T } from '../../components/ui';
import { REPEAT_LABEL, isoDate, thisWeek } from '../../lib/repeat';
import { DateInput, TimeField } from '../../components/date-input';
import { getSetting, useEvents } from '../../data/db';
import { loadGroupInfo, loadGroupSummary, removeMember, setGroupDescription, setMyColor } from '../../lib/groups';
import { confirm } from '../../lib/confirm';
import { getGroupLook } from '../../lib/group-look';
import { GroupBackdrop, GroupListCard, GroupLookEditor, MemberBubbles } from '../../components/group-card';
import { addActivity, createGroup, deleteActivities, updateActivity, groupsConfigured, leaveGroup, loadActivities, loadMembers, nextDateFor, saveGroups, savedGroups, shareBusy, type Activity, type ActivityRepeat, type Group, type MemberBusy } from '../../lib/groups';
import { DAY_NAMES, DAY_SHORT, formatDuration, formatTime, parseTime } from '../../lib/time';
import type { Weekday } from '../../lib/types';
import { colors, radius, space } from '../../theme/tokens';

export default function Groups() {
  const allEvents = useEvents();
  const events = useMemo(() => thisWeek(allEvents), [allEvents]);

  const [groups, setGroups] = useState<Group[]>(savedGroups);
  const params = useLocalSearchParams<{ open?: string }>();
  const [open, setOpen] = useState<Group | null>(null);
  const [members, setMembers] = useState<MemberBusy[]>([]);
  const [picked, setPicked] = useState(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; });
  const day = picked.getDay() as Weekday;
  const [showAll, setShowAll] = useState(false);
  const [synced, setSynced] = useState(false);
  const [selActs, setSelActs] = useState(false);
  const [pickedActs, setPickedActs] = useState<Set<string>>(new Set());
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [scanning, setScanning] = useState(false);
  const [qrError, setQrError] = useState('');
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
  const [busy, setBusy] = useState(false);
  const [desc, setDesc] = useState('');
  const [info, setInfo] = useState<{ description: string; isOwner: boolean; ownerId?: string; myId?: string } | null>(null);
  const [editDesc, setEditDesc] = useState<string | null>(null);
  const [styling, setStyling] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [summaries, setSummaries] = useState<Record<string, { description: string; members: string[] }>>({});
  // Fill the list cards with member names and descriptions.
  useEffect(() => {
    if (open || !groupsConfigured) return;
    let live = true;
    Promise.all(groups.map(async (g) => [g.id, await loadGroupSummary(g.id).catch(() => ({ description: '', members: [] }))] as const))
      .then((rows) => { if (live) setSummaries(Object.fromEntries(rows)); });
    return () => { live = false; };
  }, [groups, open]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [plan, setPlan] = useState<{ id?: string; title: string; day: string; start: string; end: string; place: string; repeat?: ActivityRepeat } | null>(null);
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
    const memberColors = assignColors(members);
    const colorOf = (i: number) => memberColors[i] ?? MEMBER_COLORS[0];
    return (
      <Screen title={open.name} back={false}
        left={<Pressable accessibilityRole="button" accessibilityLabel="Group settings" onPress={() => setSettingsOpen(true)} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><Icon name="settings-outline" size={24} /></Pressable>}
        right={<Button kind="text" label="Close" onPress={() => setOpen(null)} />}>
        {error && <Banner tone="error" title="Could not load" message={error} />}
        <GroupBackdrop groupId={open.id} style={{ padding: space.lg, gap: space.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              {getGroupLook(open.id).photo ? <Image source={{ uri: getGroupLook(open.id).photo }} style={{ width: 56, height: 56 }} /> : <Icon name="people" size={28} color={getGroupLook(open.id).accent} />}
            </View>
            <View style={{ flex: 1 }}>
              <T v="section">{open.name}</T>
              <T v="caption" color={colors.textSecondary}>{members.length} {members.length === 1 ? 'member' : 'members'}</T>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Invite people" onPress={() => router.push({ pathname: '/invite', params: { name: open.name, code: open.code, expiresAt: open.expiresAt } })}
              style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.white, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 }}>
              <Icon name="person-add-outline" size={16} color={getGroupLook(open.id).accent} />
              <T v="captionStrong">Invite</T>
            </Pressable>
          </View>
          {info?.description ? <T>{info.description}</T> : null}
          <MemberBubbles names={members.map((m) => m.displayName)} colorsFor={members.map((_, i) => colorOf(i))} accent={getGroupLook(open.id).accent} max={12} />
        </GroupBackdrop>
        <Modal transparent animationType="fade" visible={settingsOpen} onRequestClose={() => { setSettingsOpen(false); setEditDesc(null); }}>
          <Pressable onPress={() => { setSettingsOpen(false); setEditDesc(null); }} style={{ flex: 1, backgroundColor: 'rgba(58,42,44,0.35)', justifyContent: 'flex-end' }} accessibilityLabel="Close">
            <Pressable onPress={() => {}} style={{ backgroundColor: colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: space.xl, gap: space.md, maxHeight: '85%' }}>
              <ScrollView contentContainerStyle={{ gap: space.md }}>
                <T v="section">Group settings</T>
                <Button kind="secondary" icon="color-palette-outline" label="Color, photo and icon" onPress={() => { setSettingsOpen(false); setStyling(open.id); }} />
                {info?.isOwner && (editDesc !== null ? (
                  <>
                    <Field label="Description (optional)" value={editDesc} onChangeText={(v) => setEditDesc(v.slice(0, 200))} placeholder="e.g. Our thesis group for 4th year" />
                    <View style={{ flexDirection: 'row', gap: space.md }}>
                      <Button kind="secondary" label="Cancel" style={{ flex: 1 }} onPress={() => setEditDesc(null)} />
                      <Button label="Save" style={{ flex: 1 }} loading={busy} onPress={() => run(async () => { await setGroupDescription(open.id, editDesc); setInfo({ ...info!, description: editDesc.trim() }); setEditDesc(null); })} />
                    </View>
                  </>
                ) : <Button kind="secondary" icon="create-outline" label={info.description ? 'Edit description' : 'Add description'} onPress={() => setEditDesc(info.description)} />)}
                <View style={{ gap: 6 }}>
                  <T v="label">Your color</T>
                  <T v="caption" color={colors.textSecondary}>Everyone in the group sees you in this color. Colors other members already use can't be picked.</T>
                  {(() => {
                    const mine = members.findIndex((m) => m.userId === info?.myId);
                    if (mine < 0) return <T v="caption" color={colors.textSecondary}>Sync your times first to pick a color.</T>;
                    const taken = new Set(memberColors.filter((_, i) => i !== mine));
                    return (
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                        {MEMBER_COLORS.map((c) => {
                          const isTaken = taken.has(c), on = colorOf(mine) === c;
                          return (
                            <Pressable key={c} disabled={isTaken || busy} accessibilityRole="button" accessibilityLabel={`Color ${c}${isTaken ? ', taken' : ''}`} accessibilityState={{ selected: on, disabled: isTaken }}
                              onPress={() => run(async () => { await setMyColor(open.id, c); setMembers(await loadMembers(open.id)); })}
                              style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: c, opacity: isTaken ? 0.2 : 1, borderWidth: on ? 3 : 0, borderColor: colors.text, alignItems: 'center', justifyContent: 'center' }}>
                              {isTaken && <Icon name="close" size={16} color={colors.text} />}
                            </Pressable>
                          );
                        })}
                      </View>
                    );
                  })()}
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: 4 }}>
                    {members.map((m, i) => (
                      <View key={m.userId} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colorOf(i) }} />
                        <T v="caption">{m.userId === info?.myId ? `${m.displayName} (you)` : m.displayName}</T>
                      </View>
                    ))}
                  </View>
                </View>
                {info?.isOwner && (
                  <View style={{ gap: 2 }}>
                    <T v="label">Manage members</T>
                    {members.filter((m) => m.userId !== info.ownerId).length === 0 && <T v="caption" color={colors.textSecondary}>No one else has joined yet. Use Invite to add people.</T>}
                    {members.filter((m) => m.userId !== info.ownerId).map((m) => (
                      <View key={m.userId} style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <T style={{ flex: 1 }} lines={1}>{m.displayName}</T>
                        <Button kind="text" label="Remove" onPress={() => confirm(`Remove ${m.displayName}?`, 'They leave the group and their busy times are deleted. They can rejoin with the invite code.', [
                          { text: 'Remove', destructive: true, onPress: () => run(async () => { await removeMember(open.id, m.userId); setMembers(await loadMembers(open.id)); }) },
                        ])} />
                      </View>
                    ))}
                  </View>
                )}
                <Button kind="text" label="Leave group" icon="exit" onPress={() => { setSettingsOpen(false); run(async () => { await leaveGroup(open.id); save(groups.filter((g) => g.id !== open.id)); setOpen(null); }); }} />
                <Button kind="secondary" label="Done" onPress={() => { setSettingsOpen(false); setEditDesc(null); }} />
              </ScrollView>
            </Pressable>
          </Pressable>
        </Modal>
        <GroupLookEditor groupId={styling} onClose={() => setStyling(null)} />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <T v="section">Group calendar</T>
          <Pressable accessibilityRole="button" accessibilityLabel="Update my busy times" disabled={busy}
            onPress={() => run(async () => { await shareBusy(open.id, events); setMembers(await loadMembers(open.id)); setSynced(true); })}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, opacity: busy ? 0.5 : 1 }}>
            <Icon name={synced ? 'checkmark' : 'refresh'} size={14} color={colors.strawberryStrong} />
            <T v="caption" style={{ fontWeight: '700' }}>{synced ? 'Updated' : 'Sync my times'}</T>
          </Pressable>
        </View>
        <GroupCalendar members={members} activities={activities} colorOf={colorOf} picked={picked} onPick={(d) => { setPicked(d); setShowAll(false); }} />
        <T v="section">{picked.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</T>
        {activities.filter((a) => activityOn(a, picked)).map((a) => (
          <View key={a.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: colors.white, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border, padding: space.md }}>
            <T>⭐</T>
            <View style={{ flex: 1 }}>
              <T v="cardTitle">{a.title}</T>
              <T v="caption" color={colors.textSecondary}>{formatTime(a.startMin)} – {formatTime(a.endMin)}{a.place ? ` · ${a.place}` : ''}</T>
            </View>
          </View>
        ))}
        <DayOverlay members={members} day={day} colorOf={colorOf} title="Who's busy"
          plans={activities.filter((a) => activityOn(a, picked))} />
        <T v="label">Best times</T>
        {(() => {
          const wins = freeWindows(members, day);
          if (!wins.length) return <Empty icon="time-outline" title="No good free time" message="Most of the group is busy between 7 AM and 9 PM on this day. Try another day." />;
          return (
            <>
              {(showAll ? wins : wins.slice(0, 3)).map((w, i) => (
                <Card key={i} style={{ gap: 6 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                    <T v="cardTitle" style={{ flex: 1 }}>{formatTime(w.startMin)} – {formatTime(w.endMin)}</T>
                    <Badge tone={w.busy.length ? 'warning' : 'success'} label={w.busy.length ? `${w.free.length} of ${members.length} free` : 'Everyone free'} />
                  </View>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                    {w.free.map((m) => <Who key={m.userId} name={m.displayName} color={colorOf(members.indexOf(m))} />)}
                    {w.busy.length > 0 && <T v="caption" color={colors.textSecondary}>· busy:</T>}
                    {w.busy.map((m) => <Who key={m.userId} name={m.displayName} color={colorOf(members.indexOf(m))} dim />)}
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <T v="caption" color={colors.textSecondary}>{formatDuration(w.endMin - w.startMin)}</T>
                    <Button kind="text" icon="add" label="Plan" onPress={() => { setPlanErr(null); setPlan({ title: '', day: isoDate(picked), start: formatTime(w.startMin), end: formatTime(Math.min(w.endMin, w.startMin + 60)), place: '' }); }} />
                  </View>
                </Card>
              ))}
              {wins.length > 3 && <Button kind="text" label={showAll ? 'Show fewer' : `Show all ${wins.length} times`} onPress={() => setShowAll(!showAll)} style={{ alignSelf: 'center' }} />}
            </>
          );
        })()}
        <Banner tone="matcha" title="Private by design" message="Members see only when you are busy, never what your events are." />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <T v="section">Group activities</T>
          {activities.length > 0 && <Button kind="text" label={selActs ? 'Done' : 'Select'} onPress={() => { setSelActs(!selActs); setPickedActs(new Set()); }} />}
        </View>
        <T v="caption" color={colors.textSecondary}>Set a date for a meeting or activity. Everyone in the group can see it.</T>
        {activities.length === 0 && !plan && <Empty icon="calendar-outline" title="Nothing planned yet" message="Pick a free time below and tap Plan, or add one yourself." />}
        {activities.map((a) => {
          const on = pickedActs.has(a.id);
          const toggle = () => { const n = new Set(pickedActs); if (on) n.delete(a.id); else n.add(a.id); setPickedActs(n); };
          return (
            <Pressable key={a.id} disabled={!selActs} onPress={toggle} accessibilityRole={selActs ? 'checkbox' : undefined} accessibilityState={selActs ? { checked: on } : undefined}
              style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              {selActs && <Icon name={on ? 'checkbox' : 'square-outline'} size={26} color={on ? colors.strawberryStrong : colors.textSecondary} />}
              <Card style={{ gap: 4, flex: 1 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <T v="cardTitle" style={{ flex: 1 }}>{a.title}</T>
                  {!selActs && <Button kind="text" icon="create-outline" label="Edit" onPress={() => { setPlanErr(null); setPlan({ id: a.id, title: a.title, day: a.day, start: formatTime(a.startMin), end: formatTime(a.endMin), place: a.place, repeat: a.repeat }); }} />}
                </View>
                <T>{a.repeat === 'once' ? new Date(a.day + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
                  : a.repeat === 'daily' ? 'Every day'
                  : a.repeat === 'weekly' ? `Every ${new Date(a.day + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long' })}`
                  : `Every month on day ${new Date(a.day + 'T00:00:00').getDate()}`} · {formatTime(a.startMin)} – {formatTime(a.endMin)}</T>
                <T v="caption" color={colors.textSecondary}>{a.place ? `${a.place} · ` : ''}Added by {a.by || 'a member'}</T>
              </Card>
            </Pressable>
          );
        })}
        {selActs && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.white, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border, padding: space.md }}>
            <T v="captionStrong" style={{ flex: 1 }}>{pickedActs.size} selected</T>
            <Button kind="secondary" label="Cancel" onPress={() => { setSelActs(false); setPickedActs(new Set()); }} />
            <Button icon="trash" label="Delete" disabled={pickedActs.size === 0} onPress={() => confirm(`Delete ${pickedActs.size} ${pickedActs.size === 1 ? 'activity' : 'activities'}?`, 'They are removed for everyone in the group.', [
              { text: 'Delete', destructive: true, onPress: () => run(async () => { await deleteActivities([...pickedActs]); setSelActs(false); setPickedActs(new Set()); setActivities(await loadActivities(open.id)); }) },
            ])} />
          </View>
        )}
        {plan ? (
          <Card style={{ gap: space.md }}>
            <T v="cardTitle">{plan.id ? 'Edit activity' : 'Plan an activity'}</T>
            {planErr && <Banner tone="error" title="Check the details" message={planErr} />}
            <Field label="What" value={plan.title} onChangeText={(v) => setPlan({ ...plan, title: v })} placeholder="e.g. Thesis meeting" />
            <View style={{ gap: 6 }}>
              <T v="label">How often?</T>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {(['once', 'daily', 'weekly', 'monthly'] as ActivityRepeat[]).map((r) => (
                  <Chip key={r} label={REPEAT_LABEL[r]} on={(plan.repeat ?? 'once') === r} onPress={() => setPlan({ ...plan, repeat: r })} />
                ))}
              </View>
            </View>
            <View style={{ gap: 6 }}>
              <T v="label">{(plan.repeat ?? 'once') === 'once' ? 'Date' : 'Starting on'}</T>
              <DateInput value={plan.day} onChange={(v) => setPlan({ ...plan, day: v })} />
            </View>
            <View style={{ flexDirection: 'row', gap: space.md }}>
              <View style={{ flex: 1 }}><TimeField label="Start" value={plan.start} onChange={(v) => setPlan({ ...plan, start: v })} /></View>
              <View style={{ flex: 1 }}><TimeField label="End" value={plan.end} onChange={(v) => setPlan({ ...plan, end: v })} /></View>
            </View>
            <Field label="Place (optional)" value={plan.place} onChangeText={(v) => setPlan({ ...plan, place: v })} placeholder="e.g. Library" />
            <View style={{ flexDirection: 'row', gap: space.md }}>
              <Button kind="secondary" label="Cancel" style={{ flex: 1 }} onPress={() => setPlan(null)} />
               <Button label={plan.id ? 'Save changes' : 'Share with group'} style={{ flex: 1 }} loading={busy} onPress={() => {
                const st = parseTime(plan.start)?.minutes, en = parseTime(plan.end)?.minutes;
                const d = /^\d{4}-\d{2}-\d{2}$/.test(plan.day) ? new Date(plan.day + 'T00:00:00') : null;
                const today = new Date(); today.setHours(0, 0, 0, 0);
                const err = !plan.title.trim() ? 'Add a name for the activity.'
                  : !d || isNaN(d.getTime()) ? 'Enter the date like 2026-11-03.'
                  : d < today && !plan.id && (plan.repeat ?? 'once') === 'once' ? 'Pick today or a later date.'
                  : st === undefined || en === undefined ? 'Enter times like 3:00 PM.'
                  : en <= st ? 'The end time must be after the start time.' : null;
                if (err) { setPlanErr(err); return; }
                run(async () => {
                  const fields = { title: plan.title, day: plan.day, startMin: st!, endMin: en!, place: plan.place, repeat: plan.repeat ?? 'once' };
                  if (plan.id) await updateActivity(plan.id, fields); else await addActivity(open.id, fields, displayName); setPlan(null); setActivities(await loadActivities(open.id)); });
              }} />
            </View>
          </Card>
        ) : (
          <Button kind="tonal" icon="add" label="Plan an activity" onPress={() => { setPlanErr(null); setPlan({ title: '', day: isoDate(picked), start: '3:00 PM', end: '4:00 PM', place: '' }); }} />
        )}
      </Screen>
    );
  }

  return (
    <Screen title="Groups" right={<Button kind="text" icon={creating ? 'close' : 'add'} label={creating ? 'Close' : 'New'} onPress={() => setCreating(!creating)} />}>
      <T color={colors.textSecondary}>Create or join a group to see when everyone is free. Only your busy times are shared, never event names, rooms, or instructors.</T>
      {error && <Banner tone="error" title="Could not finish" message={error} />}
      {(creating || groups.length === 0) && <Card style={{ gap: space.md }}>
        <T v="cardTitle">Create a group</T>
        <Field label="Group name" value={name} onChangeText={setName} placeholder="e.g. Thesis team" />
        <Field label="Description (optional)" value={desc} onChangeText={(v) => setDesc(v.slice(0, 200))} placeholder="e.g. Our thesis group for 4th year" />
        <Button label="Create" loading={busy} disabled={!name.trim()} onPress={() => run(async () => { const g = await createGroup(name.trim(), displayName, events); if (desc.trim()) await setGroupDescription(g.id, desc); save([...groups, g]); setName(''); setDesc(''); setCreating(false); setOpen(g); })} />
      </Card>}
      {groups.map((g) => (
        <GroupListCard key={g.id} id={g.id} name={g.name} description={summaries[g.id]?.description} members={summaries[g.id]?.members} onPress={() => setOpen(g)} />
      ))}
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
      <InviteAppCard />
      <QrScanner open={scanning} onClose={() => setScanning(false)} onResult={(t) => { setScanning(false); joinFromQr(t); }} />
    </Screen>
  );
}

/** A member's name with their color, used in the free-time list. */
function Who({ name, color, dim }: { name: string; color: string; dim?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: dim ? '#F3EEEE' : colors.card, borderRadius: 999, paddingVertical: 2, paddingHorizontal: 8, opacity: dim ? 0.7 : 1 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      <T v="caption" style={{ textDecorationLine: dim ? 'line-through' : 'none' }}>{name}</T>
    </View>
  );
}
