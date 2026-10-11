// Group free-time sharing through Supabase (hosted Postgres database + login).
//
// What is uploaded: only your busy blocks (day, start, end). Never titles,
// rooms, instructors, or files. The database rules in supabase/schema.sql
// only let members of the same group read each other's busy blocks.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import Storage from 'expo-sqlite/kv-store';
import { Platform } from 'react-native';
import type { BusyBlock, ScheduleEvent } from './types';
import { toBusyBlocks } from './freeTime';
import { getSetting, setSetting } from '../data/db';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const groupsConfigured = Boolean(url && anonKey);
let client: SupabaseClient | null = null;
/** The shared Supabase client, also used for log in and sign up (see auth.ts). */
export function sb(): SupabaseClient {
  if (!groupsConfigured) throw new Error('Group sharing is not set up yet. Add your Supabase keys to the .env file.');
  client ??= createClient(url!, anonKey!, {
    // Keeps you signed in between app launches so you stay in your groups.
    // On the web the browser's own localStorage is used (works in every browser).
    auth: { storage: Platform.OS === 'web' ? undefined : Storage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });
  return client;
}

async function ensureSignedIn(displayName: string) {
  const { data } = await sb().auth.getSession();
  if (data.session) return data.session.user.id;
  const res = await sb().auth.signInAnonymously({ options: { data: { display_name: displayName } } });
  if (res.error) throw res.error;
  return res.data.user!.id;
}

export interface Group { id: string; name: string; code: string; expiresAt: string }
export interface MemberBusy { userId: string; displayName: string; blocks: BusyBlock[] }

export async function createGroup(name: string, displayName: string, events: ScheduleEvent[]): Promise<Group> {
  await ensureSignedIn(displayName);
  const { data, error } = await sb().rpc('create_group', { group_name: name, member_name: displayName });
  if (error) throw error;
  await shareBusy(data.id, events);
  return { id: data.id, name: data.name, code: data.code, expiresAt: data.expires_at };
}

export async function joinGroup(code: string, displayName: string, events: ScheduleEvent[]): Promise<Group> {
  await ensureSignedIn(displayName);
  const { data, error } = await sb().rpc('join_group', { invite_code: code.trim().toUpperCase(), member_name: displayName });
  if (error) throw new Error(error.message.includes('expired') ? 'This invite has expired.' : 'That code was not found.');
  await shareBusy(data.id, events);
  return { id: data.id, name: data.name, code: data.code, expiresAt: data.expires_at };
}

/** 4.3 Join Group: looks up an invite code before joining. Shows only name, size, and expiry. */
export async function previewGroup(code: string, displayName: string) {
  await ensureSignedIn(displayName);
  const { data, error } = await sb().rpc('group_preview', { invite_code: code.trim().toUpperCase() });
  if (error) throw error;
  const row = (data as { name: string; member_count: number; expires_at: string }[] | null)?.[0];
  if (!row) throw new Error('That code was not found.');
  return { name: row.name, memberCount: Number(row.member_count), expiresAt: row.expires_at };
}

/** Saved list of groups you are in, kept on this phone. */
export const savedGroups = (): Group[] => getSetting<Group[]>('groups', []);
export const saveGroups = (g: Group[]) => setSetting('groups', g);

/** Replaces my busy blocks in a group. Only day/start/end are sent. */
export async function shareBusy(groupId: string, events: ScheduleEvent[]) {
  const blocks = toBusyBlocks(events);
  const { error } = await sb().rpc('replace_busy_blocks', {
    gid: groupId,
    blocks: blocks.map((b) => ({ weekday: b.weekday, start_min: b.startMin, end_min: b.endMin })),
  });
  if (error) throw error;
}

export async function loadMembers(groupId: string): Promise<MemberBusy[]> {
  const { data: members, error } = await sb().from('group_members').select('user_id, display_name').eq('group_id', groupId);
  if (error) throw error;
  const { data: blocks, error: e2 } = await sb().from('busy_blocks').select('user_id, weekday, start_min, end_min').eq('group_id', groupId);
  if (e2) throw e2;
  return (members ?? []).map((m) => ({
    userId: m.user_id,
    displayName: m.display_name,
    blocks: (blocks ?? [])
      .filter((b) => b.user_id === m.user_id)
      .map((b) => ({ weekday: b.weekday, startMin: b.start_min, endMin: b.end_min })),
  }));
}

export async function leaveGroup(groupId: string) {
  const { error } = await sb().rpc('leave_group', { gid: groupId });
  if (error) throw error;
}
