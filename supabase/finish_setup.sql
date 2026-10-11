-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run.
-- The tables, security policies, create_group and join_group are already set up.
-- This adds the last four functions. It only creates functions; no data is changed.

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
  from groups g where g.code = upper(invite_code);
$$;

-- Only signed-in people (including anonymous sign-ins) may call these functions.
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
