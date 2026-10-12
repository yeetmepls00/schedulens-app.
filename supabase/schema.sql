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
  username text not null check (char_length(username) between 1 and 40),
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
-- Only accounts with a confirmed email (not anonymous) may use groups.
create or replace function is_verified() returns boolean
language sql security definer stable set search_path = public, auth as $$
  select exists (select 1 from auth.users where id = auth.uid()
    and email_confirmed_at is not null and coalesce(is_anonymous, false) = false);
$$;

create or replace function is_member(gid uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select is_verified() and exists (select 1 from group_members where group_id = gid and user_id = auth.uid());
$$;

create policy "members read their groups" on groups for select using (is_member(id));
create policy "members read member list" on group_members for select using (is_member(group_id));
create policy "members read busy blocks" on busy_blocks for select using (is_member(group_id));
-- All writes go through the functions below.

create or replace function create_group(group_name text, member_name text) returns groups
language plpgsql security definer set search_path = public as $$
declare g groups;
begin
  if not is_verified() then raise exception 'email not confirmed'; end if;
  insert into groups (name, code, owner)
  values (group_name, upper(substr(md5(random()::text), 1, 6)), auth.uid())
  returning * into g;
  insert into group_members (group_id, user_id, username) values (g.id, auth.uid(), member_name);
  return g;
end $$;

create or replace function join_group(invite_code text, member_name text) returns groups
language plpgsql security definer set search_path = public as $$
declare g groups;
begin
  if not is_verified() then raise exception 'email not confirmed'; end if;
  select * into g from groups where code = invite_code;
  if g.id is null then raise exception 'not found'; end if;
  if g.expires_at < now() then raise exception 'expired'; end if;
  insert into group_members (group_id, user_id, username)
  values (g.id, auth.uid(), member_name)
  on conflict (group_id, user_id) do update set username = excluded.username;
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

-- 4.3 Join Group: shows the group name, member count, and expiry for an invite
-- code before the person decides to join. Reveals nothing about schedules.
create or replace function group_preview(invite_code text)
returns table (name text, member_count bigint, expires_at timestamptz)
language sql security definer stable set search_path = public as $$
  select g.name, (select count(*) from group_members m where m.group_id = g.id), g.expires_at
  from groups g where g.code = upper(invite_code) and is_verified();
$$;

-- Only signed-in people may call these functions.
revoke execute on function is_verified() from public, anon;
grant execute on function is_verified() to authenticated;
revoke execute on function is_member(uuid), create_group(text, text), join_group(text, text),
  replace_busy_blocks(uuid, jsonb), leave_group(uuid), group_preview(text) from public, anon;
grant execute on function is_member(uuid), create_group(text, text), join_group(text, text),
  replace_busy_blocks(uuid, jsonb), leave_group(uuid), group_preview(text) to authenticated;

-- 4.6 Data & Privacy -> Delete account: removes your sign-in and, through
-- "on delete cascade", every group membership and busy block you shared.
create or replace function delete_my_account() returns void
language sql security definer set search_path = public, auth as $$
  delete from auth.users where id = auth.uid();
$$;
revoke execute on function delete_my_account() from public, anon;
grant execute on function delete_my_account() to authenticated;
