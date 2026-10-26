-- Optional group description. Only the group's owner can change it, and only that column.
alter table public.groups add column if not exists description text check (description is null or char_length(description) <= 200);

revoke update on public.groups from anon, authenticated;
grant update (description) on public.groups to authenticated;

create policy "owner edits description" on public.groups for update
  using (owner = auth.uid()) with check (owner = auth.uid());
