// 2.5 Notifications. Built from your own data: today's warnings and recent imports.
// (Phone push reminders are not built yet; this is the in-app list.)
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { getSetting, setSetting } from '../data/db';
import { applyUpdate, useUpdateReady } from '../lib/update';
import { groupsConfigured, recentJoins, savedGroups, type JoinNotice } from '../lib/groups';
import { Badge, Button, Card, Empty, Screen, T } from '../components/ui';
import { useFiles } from '../data/db';
import { useSchedule } from '../data/hooks';
import { colors, space } from '../theme/tokens';

const TITLE = { overlap: 'Conflict', travel: 'Short travel time', workload: 'Long continuous activity' } as const;

export default function Notifications() {
  const { issues } = useSchedule();
  const files = useFiles();
  const today = new Date().getDay();
  // "Clear all" hides everything up to that moment; today's warnings stay hidden until tomorrow.
  const [clearedAt, setClearedAt] = useState(() => getSetting<string>('notifClearedAt', ''));
  const cleared = clearedAt ? Date.parse(clearedAt) : 0;
  const clearedToday = !!clearedAt && new Date(clearedAt).toDateString() === new Date().toDateString();
  const todays = clearedToday ? [] : issues.filter((i) => i.weekday === today);
  const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
  const recent = files.filter((f) => Date.parse(f.createdAt) >= Math.max(weekAgo, cleared));
  const updatedAt = getSetting<string>('updatedAt', '');
  const updated = !!updatedAt && Date.parse(updatedAt) > cleared;
  // New members in your groups from the past week. Opening this screen marks them as seen.
  const [joins, setJoins] = useState<JoinNotice[]>([]);
  useEffect(() => {
    if (!groupsConfigured) return;
    recentJoins(savedGroups(), new Date(Math.max(weekAgo, cleared)).toISOString()).then(setJoins).catch(() => {});
    setSetting('joinsSeenAt', new Date().toISOString());
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const update = useUpdateReady();
  const shownJoins = joins.filter((j) => Date.parse(j.at) > cleared);
  const empty = !update && !updated && todays.length === 0 && recent.length === 0 && shownJoins.length === 0;
  function clearAll() { const now = new Date().toISOString(); setSetting('notifClearedAt', now); setClearedAt(now); }
  return (
    <Screen title="Notifications" back right={empty ? undefined : <Button kind="text" label="Clear all" onPress={clearAll} />}>
      {empty ? (
        <Empty icon="notifications-outline" title="You're all caught up" message="Warnings for today, new imports, group members and app updates will show here." />
      ) : (
        <>
          {update && (
            <Card style={{ gap: space.sm }}>
              <Badge tone="success" label="Update available" />
              <T>A new version of ScheduLens is ready, with the latest fixes and features. ✨</T>
              <View style={{ alignItems: 'flex-end' }}><Button kind="text" label="Update now" onPress={applyUpdate} /></View>
            </Card>
          )}
          {updated && (
            <Card style={{ gap: space.sm }}>
              <Badge tone="success" label="App updated" />
              <T>ScheduLens was updated to the newest version. ✨</T>
              <T v="caption" color={colors.textSecondary}>{new Date(updatedAt).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</T>
            </Card>
          )}
          {todays.length > 0 && <T v="section">Today</T>}
          {todays.map((i, n) => (
            <Card key={n} style={{ gap: space.sm }}>
              <Badge tone={i.kind === 'overlap' ? 'error' : 'warning'} label={TITLE[i.kind]} />
              <T>{i.message}</T>
              <View style={{ alignItems: 'flex-end' }}><Button kind="text" label="Review" onPress={() => router.push('/review')} /></View>
            </Card>
          ))}
          {shownJoins.length > 0 && <T v="section">Groups</T>}
          {shownJoins.map((j) => (
            <Card key={j.groupId + j.at} style={{ gap: space.sm }}>
              <Badge tone="success" label="New member" />
              <T>{j.name} joined {j.groupName} 🎉</T>
              <T v="caption" color={colors.textSecondary}>{new Date(j.at).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' })}</T>
              <View style={{ alignItems: 'flex-end' }}><Button kind="text" label="Open group" onPress={() => router.push({ pathname: '/groups', params: { open: j.groupId } })} /></View>
            </Card>
          ))}
          {recent.length > 0 && <T v="section">Earlier</T>}
          {recent.map((f) => (
            <Card key={f.id} style={{ gap: space.sm }}>
              <Badge tone="success" label="Schedule imported" />
              <T>{f.name}: {f.eventCount} {f.eventCount === 1 ? 'event' : 'events'} added.</T>
              <T v="caption" color={colors.textSecondary}>{new Date(f.createdAt).toLocaleDateString()}</T>
              <View style={{ alignItems: 'flex-end' }}><Button kind="text" label="View" onPress={() => router.push('/vault')} /></View>
            </Card>
          ))}
        </>
      )}
    </Screen>
  );
}
