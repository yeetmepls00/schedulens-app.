-- Group activities: a date and time that every member of a group can see.
create table public.group_activities (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  created_by uuid not null default auth.uid(),
  created_by_name text not null default '',
  title text not null check (char_length(title) between 1 and 80),
  day date not null,
  start_min smallint not null check (start_min between 0 and 1439),
  end_min smallint not null check (end_min between 1 and 1440 and end_min > start_min),
  place text check (place is null or char_length(place) <= 80),
  created_at timestamptz not null default now()
);
create index group_activities_group_day on public.group_activities (group_id, day);
alter table public.group_activities enable row level security;
create policy "members read activities" on public.group_activities for select to authenticated using (is_member(group_id));
create policy "members add activities" on public.group_activities for insert to authenticated with check (is_member(group_id) and created_by = auth.uid());
create policy "creator removes activity" on public.group_activities for delete to authenticated using (created_by = auth.uid() and is_member(group_id));
