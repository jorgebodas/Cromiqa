-- Cromiqa · shared test world
-- Lets several people test the prototype together from their own phones: every signed-in
-- tester reads and writes the same demo data (users, mechanics, requests), and changes reach
-- the others in real time.
--
-- Run once in Supabase → SQL Editor → New query → paste → Run. Safe to run again.
--
-- Design: the whole demo world is one JSON document (the app's business rules already work on
-- it), versioned so two simultaneous changes never overwrite each other. This is for testing
-- with trusted people, not production data: any signed-in tester can read and change it.

create table if not exists public.demo_world (
  id text primary key,
  version bigint not null default 1,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.demo_world enable row level security;

drop policy if exists "testers read the shared world" on public.demo_world;
create policy "testers read the shared world" on public.demo_world
  for select to authenticated using (true);

drop policy if exists "testers create the shared world" on public.demo_world;
create policy "testers create the shared world" on public.demo_world
  for insert to authenticated with check (true);

drop policy if exists "testers update the shared world" on public.demo_world;
create policy "testers update the shared world" on public.demo_world
  for update to authenticated using (true) with check (true);

-- Compare-and-swap: saves only if nobody saved in between (otherwise the app retries on the
-- latest data). Returns the new version.
create or replace function public.demo_world_commit(p_id text, p_expected bigint, p_data jsonb)
returns bigint
language plpgsql
security invoker
set search_path = public
as $$
declare
  v bigint;
begin
  update public.demo_world
     set data = p_data, version = version + 1, updated_at = now()
   where id = p_id and version = p_expected
  returning version into v;
  if v is null then
    raise exception 'demo_world_conflict' using errcode = '40001';
  end if;
  return v;
end;
$$;

grant execute on function public.demo_world_commit(text, bigint, jsonb) to authenticated;

-- Real-time: the app listens to changes on this table.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'demo_world'
  ) then
    alter publication supabase_realtime add table public.demo_world;
  end if;
end;
$$;
