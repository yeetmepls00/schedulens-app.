// How each group looks on this device: a color theme and an optional cover photo.
// Saved only on this phone, like the profile photo, so photos are never uploaded.
import { getSetting, setSetting } from '../data/db';

export const GROUP_THEMES = [
  { id: 'strawberry', label: 'Strawberry', colors: ['#FFD6DE', '#FFF1F3'], accent: '#C2324F' },
  { id: 'matcha', label: 'Matcha', colors: ['#D7EBC4', '#F3F9EC'], accent: '#4E7A2E' },
  { id: 'peach', label: 'Peach', colors: ['#FFDCC2', '#FFF4EA'], accent: '#C2621F' },
  { id: 'lemon', label: 'Lemon', colors: ['#FFF0A8', '#FFFBE3'], accent: '#9A7A00' },
  { id: 'sky', label: 'Sky', colors: ['#CFE6FF', '#EFF6FF'], accent: '#2F6DB5' },
  { id: 'lavender', label: 'Lavender', colors: ['#E3D7FF', '#F6F1FF'], accent: '#6B46C1' },
  { id: 'mint', label: 'Mint', colors: ['#C8F0E6', '#EEFAF6'], accent: '#1F7A70' },
  { id: 'cocoa', label: 'Cocoa', colors: ['#E8D5C8', '#F8F0EA'], accent: '#7A4B32' },
] as const;
export type GroupThemeId = (typeof GROUP_THEMES)[number]['id'];
export interface GroupLook { theme: GroupThemeId; photo?: string }

const all = () => getSetting<Record<string, GroupLook>>('groupLooks', {});

/** A group's look. New groups get a theme picked from their id so the list is colorful from the start. */
export function getGroupLook(groupId: string): GroupLook & { colors: readonly [string, string]; accent: string } {
  const saved = all()[groupId];
  const fallback = GROUP_THEMES[[...groupId].reduce((n, c) => n + c.charCodeAt(0), 0) % GROUP_THEMES.length].id;
  const theme = GROUP_THEMES.find((t) => t.id === (saved?.theme ?? fallback)) ?? GROUP_THEMES[0];
  return { theme: theme.id, photo: saved?.photo, colors: theme.colors, accent: theme.accent };
}

export function setGroupLook(groupId: string, look: Partial<GroupLook>) {
  const cur = getGroupLook(groupId);
  const next: GroupLook = { theme: look.theme ?? cur.theme, photo: 'photo' in look ? look.photo : cur.photo };
  setSetting('groupLooks', { ...all(), [groupId]: next });
}
