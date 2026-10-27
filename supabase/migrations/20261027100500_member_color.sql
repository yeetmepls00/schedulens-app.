-- Each member picks their own color in a group; no two members share one.
alter table public.group_members add column if not exists color text
  check (color is null or color ~ '^#[0-9A-Fa-f]{6}$');
create unique index if not exists group_members_color_unique on public.group_members (group_id, color) where color is not null;
create or replace function public.set_my_color(gid uuid, c text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update group_members set color = c where group_id = gid and user_id = auth.uid();
  if not found then raise exception 'You are not in this group'; end if;
exception when unique_violation then
  raise exception 'Someone in this group already uses that color';
end $$;
revoke all on function public.set_my_color(uuid, text) from public, anon;
grant execute on function public.set_my_color(uuid, text) to authenticated;
