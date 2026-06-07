create extension if not exists pgcrypto;

create table if not exists public.school_mobile_directory (
  id uuid primary key default gen_random_uuid(),
  school_code text not null unique,
  school_name text not null,
  supabase_url text not null,
  supabase_anon_key text not null,
  school_id text not null,
  status text not null default 'pending'
    check (status in ('pending', 'active', 'suspended', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.school_mobile_directory
  add column if not exists status text not null default 'pending';

alter table public.school_mobile_directory
  drop constraint if exists school_mobile_directory_status_check;

do $$
declare
  constraint_name text;
begin
  select conname
    into constraint_name
    from pg_constraint
   where conrelid = 'public.school_mobile_directory'::regclass
     and contype = 'c'
     and pg_get_constraintdef(oid) like '%status%pending%active%suspended%';

  if constraint_name is not null then
    execute format('alter table public.school_mobile_directory drop constraint %I', constraint_name);
  end if;
end $$;

alter table public.school_mobile_directory
  add constraint school_mobile_directory_status_check
  check (status in ('pending', 'active', 'suspended', 'rejected'));

alter table public.school_mobile_directory
  add column if not exists is_active boolean not null default true;

update public.school_mobile_directory
   set status = case when is_active then 'active' else 'suspended' end
 where status is null;

create unique index if not exists uq_school_mobile_directory_school_id
  on public.school_mobile_directory (school_id);

create index if not exists idx_school_mobile_directory_code
  on public.school_mobile_directory (school_code);

alter table public.school_mobile_directory enable row level security;

drop policy if exists "No direct directory reads" on public.school_mobile_directory;
create policy "No direct directory reads"
  on public.school_mobile_directory
  for select
  using (false);

drop policy if exists "No direct directory inserts" on public.school_mobile_directory;
create policy "No direct directory inserts"
  on public.school_mobile_directory
  for insert
  with check (false);

drop policy if exists "No direct directory updates" on public.school_mobile_directory;
create policy "No direct directory updates"
  on public.school_mobile_directory
  for update
  using (false)
  with check (false);

drop policy if exists "No direct directory deletes" on public.school_mobile_directory;
create policy "No direct directory deletes"
  on public.school_mobile_directory
  for delete
  using (false);

revoke all on table public.school_mobile_directory from anon, authenticated;

create or replace function public.lookup_school_mobile_config(p_school_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.school_mobile_directory%rowtype;
begin
  select *
    into v_row
    from public.school_mobile_directory
   where school_code = upper(trim(p_school_code))
   limit 1;

  if v_row.id is null then
    raise exception 'School code not found';
  end if;

  if v_row.status <> 'active' then
    return jsonb_build_object(
      'school_code', v_row.school_code,
      'school_name', v_row.school_name,
      'status', v_row.status
    );
  end if;

  return jsonb_build_object(
    'school_code', v_row.school_code,
    'school_name', v_row.school_name,
    'supabase_url', v_row.supabase_url,
    'supabase_anon_key', v_row.supabase_anon_key,
    'school_id', v_row.school_id,
    'status', v_row.status
  );
end;
$$;

grant execute on function public.lookup_school_mobile_config(text) to anon, authenticated;

create or replace function public.register_school_mobile_config(
  p_school_name text,
  p_supabase_url text,
  p_supabase_anon_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_prefix text;
  v_school_id text;
  v_existing public.school_mobile_directory%rowtype;
begin
  if nullif(trim(p_school_name), '') is null then
    raise exception 'School name is required';
  end if;

  if nullif(trim(p_supabase_url), '') is null
     or nullif(trim(p_supabase_anon_key), '') is null then
    raise exception 'Supabase URL and anon key are required';
  end if;

  select *
    into v_existing
    from public.school_mobile_directory
   where lower(trim(supabase_url)) = lower(trim(p_supabase_url))
   limit 1;

  if v_existing.id is not null then
    update public.school_mobile_directory
       set school_name = trim(p_school_name),
           supabase_anon_key = trim(p_supabase_anon_key),
           updated_at = now()
     where id = v_existing.id
     returning school_code, school_id into v_code, v_school_id;
  else
    v_prefix := upper(regexp_replace(trim(p_school_name), '[^A-Za-z0-9]', '', 'g'));
    v_prefix := substring(coalesce(nullif(v_prefix, ''), 'SCH') from 1 for 5);
    v_school_id := 'school_' || lower(md5(random()::text || clock_timestamp()::text || trim(p_school_name)));

    loop
      v_code := v_prefix || '-' || upper(substring(md5(random()::text || clock_timestamp()::text || v_prefix) from 1 for 6));
      exit when not exists (
        select 1 from public.school_mobile_directory where school_code = v_code
      );
    end loop;

    insert into public.school_mobile_directory
      (school_code, school_name, supabase_url, supabase_anon_key, school_id, status)
    values
      (v_code, trim(p_school_name), trim(p_supabase_url), trim(p_supabase_anon_key), v_school_id, 'pending');
  end if;

  select *
    into v_existing
    from public.school_mobile_directory
   where school_code = v_code
   limit 1;

  return jsonb_build_object(
    'school_code', v_existing.school_code,
    'school_name', v_existing.school_name,
    'school_id', v_existing.school_id,
    'status', v_existing.status
  );
end;
$$;

grant execute on function public.register_school_mobile_config(text, text, text) to anon, authenticated;

create table if not exists public.school_licenses (
  license_key text primary key,
  school_id text not null,
  school_code text not null,
  school_name text not null,
  academic_year text not null,
  license_type text not null default 'full_year'
    check (license_type in ('single_term', 'full_year')),
  activated_terms jsonb not null default '[]'::jsonb,
  max_machines int not null default 1,
  registered_hwids jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  expires_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_school_licenses_school_code
  on public.school_licenses (school_code);

create index if not exists idx_school_licenses_school_year
  on public.school_licenses (school_id, academic_year);

alter table public.school_licenses enable row level security;

drop policy if exists "No direct license reads" on public.school_licenses;
create policy "No direct license reads"
  on public.school_licenses
  for select
  using (false);

drop policy if exists "No direct license writes" on public.school_licenses;
create policy "No direct license writes"
  on public.school_licenses
  for all
  using (false)
  with check (false);

revoke all on table public.school_licenses from anon, authenticated;

create table if not exists public.school_license_devices (
  id uuid primary key default gen_random_uuid(),
  license_key text not null references public.school_licenses(license_key) on delete cascade,
  school_id text not null,
  school_code text not null,
  hwid text not null,
  academic_year text not null,
  term text not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  status text not null default 'active'
    check (status in ('active', 'removed', 'blocked'))
);

create unique index if not exists uq_school_license_devices_license_hwid
  on public.school_license_devices (license_key, hwid);

create index if not exists idx_school_license_devices_school
  on public.school_license_devices (school_id);

alter table public.school_license_devices enable row level security;

drop policy if exists "No direct device reads" on public.school_license_devices;
create policy "No direct device reads"
  on public.school_license_devices
  for select
  using (false);

drop policy if exists "No direct device writes" on public.school_license_devices;
create policy "No direct device writes"
  on public.school_license_devices
  for all
  using (false)
  with check (false);

revoke all on table public.school_license_devices from anon, authenticated;

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  school_id text,
  school_code text,
  school_name text,
  admin_user text not null default 'developer',
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_admin_audit_log_created
  on public.admin_audit_log (created_at desc);

create index if not exists idx_admin_audit_log_school_code
  on public.admin_audit_log (school_code);

alter table public.admin_audit_log enable row level security;

drop policy if exists "No direct audit reads" on public.admin_audit_log;
create policy "No direct audit reads"
  on public.admin_audit_log
  for select
  using (false);

drop policy if exists "No direct audit writes" on public.admin_audit_log;
create policy "No direct audit writes"
  on public.admin_audit_log
  for all
  using (false)
  with check (false);

revoke all on table public.admin_audit_log from anon, authenticated;

create table if not exists public.platform_settings (
  id text primary key default 'default',
  maintenance_mode boolean not null default false,
  maintenance_message text not null default '',
  minimum_desktop_version text not null default '',
  support_message text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.platform_settings (id)
values ('default')
on conflict (id) do nothing;

alter table public.platform_settings enable row level security;

drop policy if exists "No direct platform settings reads" on public.platform_settings;
create policy "No direct platform settings reads"
  on public.platform_settings
  for select
  using (false);

drop policy if exists "No direct platform settings writes" on public.platform_settings;
create policy "No direct platform settings writes"
  on public.platform_settings
  for all
  using (false)
  with check (false);

revoke all on table public.platform_settings from anon, authenticated;

-- Central admin approval example:
-- update public.school_mobile_directory
--    set status = 'active', updated_at = now()
--  where school_code = 'OTERK-7F3K';
