-- How often a group activity happens: once (default), daily, weekly or monthly.
alter table public.group_activities
  add column if not exists repeat text not null default 'once'
  check (repeat in ('once', 'daily', 'weekly', 'monthly'));
