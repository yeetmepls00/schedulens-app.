-- Owner-only: remove another member from a group.
create or replace function public.remove_member(gid uuid, uid uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from groups where id = gid and owner = auth.uid()) then
    raise exception 'Only the group owner can remove members';
  end if;
  if uid = auth.uid() then
    raise exception 'The owner cannot remove themselves';
  end if;
  delete from busy_blocks where group_id = gid and user_id = uid;
  delete from group_members where group_id = gid and user_id = uid;
end $$;
revoke all on function public.remove_member(uuid, uuid) from public, anon;
grant execute on function public.remove_member(uuid, uuid) to authenticated;
