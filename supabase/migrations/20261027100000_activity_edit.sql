-- Group activities belong to the whole group: any member can edit or delete them.
-- Members' own busy times are untouched (they live in busy_blocks, not here).
drop policy if exists "creator removes activity" on public.group_activities;
create policy "members remove activities" on public.group_activities for delete to authenticated using (is_member(group_id));
create policy "members edit activities" on public.group_activities for update to authenticated
  using (is_member(group_id)) with check (is_member(group_id));
