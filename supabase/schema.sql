-- ─────────────────────────────────────────────────────────────────────────────
-- Cromiqa · backend schema for Supabase
-- Run once in Supabase → SQL Editor → New query → paste → Run.
-- Safe to re-run: every statement is idempotent.
-- ─────────────────────────────────────────────────────────────────────────────

create extension if not exists citext;

-- ── Admins ──────────────────────────────────────────────────────────────────
-- Only emails listed here can use the admin panel. Add yours at the bottom.
create table if not exists public.admins (
  email citext primary key
);
alter table public.admins enable row level security;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where email = (auth.jwt() ->> 'email'));
$$;
grant execute on function public.is_admin() to anon, authenticated;

drop policy if exists "admins read admins" on public.admins;
create policy "admins read admins" on public.admins for select to authenticated using (public.is_admin());

-- ── Waitlist ────────────────────────────────────────────────────────────────
create table if not exists public.waitlist_leads (
  id uuid primary key default gen_random_uuid(),
  email citext not null unique
    check (length(email) <= 254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]{2,}$'),
  zone text check (length(zone) <= 80),
  source text not null default 'landing' check (length(source) <= 40),
  created_at timestamptz not null default now()
);
alter table public.waitlist_leads enable row level security;

-- Visitors may only add rows (never read them), and only these columns.
revoke all on public.waitlist_leads from anon, authenticated;
grant insert (email, zone, source) on public.waitlist_leads to anon, authenticated;
grant select, update, delete on public.waitlist_leads to authenticated;

drop policy if exists "anyone can join the waitlist" on public.waitlist_leads;
create policy "anyone can join the waitlist" on public.waitlist_leads for insert to anon, authenticated with check (true);
drop policy if exists "admins manage waitlist" on public.waitlist_leads;
create policy "admins manage waitlist" on public.waitlist_leads for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ── Mechanics & workshops ───────────────────────────────────────────────────
do $$ begin
  create type public.mechanic_status as enum ('new', 'contacted', 'talking', 'onboarded', 'discarded');
exception when duplicate_object then null; end $$;

create table if not exists public.mechanic_leads (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 2 and 120),
  workshop text check (length(workshop) <= 120),
  email citext not null unique
    check (length(email) <= 254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]{2,}$'),
  phone text check (length(phone) <= 40),
  zone text check (length(zone) <= 80),
  specialty text check (length(specialty) <= 200),
  status public.mechanic_status not null default 'new',
  notes text not null default '' check (length(notes) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.mechanic_leads enable row level security;

revoke all on public.mechanic_leads from anon, authenticated;
grant insert (name, workshop, email, phone, zone, specialty) on public.mechanic_leads to anon, authenticated;
grant select, update, delete on public.mechanic_leads to authenticated;

drop policy if exists "anyone can register as mechanic" on public.mechanic_leads;
create policy "anyone can register as mechanic" on public.mechanic_leads for insert to anon, authenticated with check (true);
drop policy if exists "admins manage mechanics" on public.mechanic_leads;
create policy "admins manage mechanics" on public.mechanic_leads for all to authenticated using (public.is_admin()) with check (public.is_admin());

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists mechanic_leads_touch on public.mechanic_leads;
create trigger mechanic_leads_touch before update on public.mechanic_leads
  for each row execute function public.touch_updated_at();

-- ── Website content (carousel texts and photos) ─────────────────────────────
create table if not exists public.site_content (
  key text primary key check (key in ('benefits', 'photos')),
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.site_content enable row level security;

revoke all on public.site_content from anon, authenticated;
grant select on public.site_content to anon, authenticated;
grant insert, update, delete on public.site_content to authenticated;

drop policy if exists "everyone reads site content" on public.site_content;
create policy "everyone reads site content" on public.site_content for select to anon, authenticated using (true);
drop policy if exists "admins edit site content" on public.site_content;
create policy "admins edit site content" on public.site_content for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop trigger if exists site_content_touch on public.site_content;
create trigger site_content_touch before update on public.site_content
  for each row execute function public.touch_updated_at();

-- ── Photo storage (public read, admin write) ────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site', 'site', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "admins upload site files" on storage.objects;
create policy "admins upload site files" on storage.objects for insert to authenticated
  with check (bucket_id = 'site' and public.is_admin());
drop policy if exists "admins update site files" on storage.objects;
create policy "admins update site files" on storage.objects for update to authenticated
  using (bucket_id = 'site' and public.is_admin());
drop policy if exists "admins delete site files" on storage.objects;
create policy "admins delete site files" on storage.objects for delete to authenticated
  using (bucket_id = 'site' and public.is_admin());

-- ── Your admin account ──────────────────────────────────────────────────────
-- 1) Create the user in Authentication → Users → Add user (email + password).
-- 2) Put the same email here and run this line:
-- insert into public.admins (email) values ('tu-email@ejemplo.com') on conflict do nothing;
