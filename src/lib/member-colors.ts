// Each member's color inside a group, used on the title card and the group calendar.
// Members pick their own color and everyone sees it; no two members share one.
import type { MemberBusy } from './groups';

export const MEMBER_COLORS = ['#E8708A', '#4D96FF', '#F4A261', '#43AA8B', '#9B6DD6', '#E9C46A', '#2A9D8F', '#8D6E63', '#FF85A1', '#5E60CE'];

/** Everyone's color, in member order: their chosen one, or the first color nobody has yet. */
export function assignColors(members: MemberBusy[]): string[] {
  const used = new Set(members.map((m) => m.color).filter(Boolean) as string[]);
  const free = MEMBER_COLORS.filter((c) => !used.has(c));
  let n = 0;
  return members.map((m) => m.color ?? free[n++ % Math.max(1, free.length)] ?? MEMBER_COLORS[0]);
}
