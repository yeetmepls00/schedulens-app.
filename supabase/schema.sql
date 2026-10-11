-- ScheduLens group sharing. Paste into Supabase: SQL Editor -> New query -> Run.
-- Stores ONLY free/busy blocks. No event titles, rooms, or instructors exist here.

create table if not exists groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 40),
  code text not null unique,
  owner uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null default now() + interval '7 days',
  created_at timestamptz not null default now()
);

create table if not exists group_members (
  group_id uuid references groups(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table if not exists busy_blocks (
  id bigint generated always as identity primary key,
  group_id uuid not null references groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  start_min smallint not null check (start_min between 0 and 1440),
  end_min smallint not null check (end_min between 0 and 1440 and end_min > start_min)
);

alter table groups enable row level security;
alter table group_members enable row level security;
alter table busy_blocks enable row level security;

-- Helper: is the signed-in user in this group?
create or replace function is_member(gid uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from group_members where group_id = gid and user_id = auth.uid());
$$;

create policy "members read their groups" on groups for select using (is_member(id));
create policy "members read member list" on group_members for select using (is_member(group_id));
create policy "members read busy blocks" on busy_blocks for select using (is_member(group_id));
-- All writes go through the functions below.

create or replace function create_group(group_name text, member_name text) returns groups
language plpgsql security definer set search_path = public as $$
declare g groups;
begin
  insert into groups (name, code, owner)
  values (group_name, upper(substr(md5(random()::text), 1, 6)), auth.uid())
  returning * into g;
  insert into group_members (group_id, user_id, display_name) values (g.id, auth.uid(), member_name);
  return g;
end $$;

create or replace function join_group(invite_code text, member_name text) returns groups
language plpgsql security definer set search_path = public as $$
declare g groups;
begin
  select * into g from groups where code = invite_code;
  if g.id is null then raise exception 'not found'; end if;
  if g.expires_at < now() then raise exception 'expired'; end if;
  insert into group_members (group_id, user_id, display_name)
  values (g.id, auth.uid(), member_name)
  on conflict (group_id, user_id) do update set display_name = excluded.display_name;
  return g;
end $$;

create or replace function replace_busy_blocks(gid uuid, blocks jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_member(gid) then raise exception 'not a member'; end if;
  delete from busy_blocks where group_id = gid and user_id = auth.uid();
  insert into busy_blocks (group_id, user_id, weekday, start_min, end_min)
  select gid, auth.uid(), (b->>'weekday')::smallint, (b->>'start_min')::smallint, (b->>'end_min')::smallint
  from jsonb_array_elements(blocks) b;
end $$;

create or replace function leave_group(gid uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from busy_blocks where group_id = gid and user_id = auth.uid();
  delete from group_members where group_id = gid and user_id = auth.uid();
end $$;
