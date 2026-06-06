create extension if not exists pgcrypto;

create table if not exists public.school_mobile_directory (
  id uuid primary key default gen_random_uuid(),
  school_code text not null unique,
  school_name text not null,
  supabase_url text not null,
  supabase_anon_key text not null,
  school_id text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_school_mobile_directory_school_id
  on public.school_mobile_directory (school_id);

create index if not exists idx_school_mobile_directory_code
  on public.school_mobile_directory (school_code)
  where is_active = true;

create table if not exists public.school_mobile_registration_tokens (
  id uuid primary key default gen_random_uuid(),
  token_name text not null,
  token_hash text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

alter table public.school_mobile_directory enable row level security;
alter table public.school_mobile_registration_tokens enable row level security;

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

drop policy if exists "No direct registration token reads" on public.school_mobile_registration_tokens;
create policy "No direct registration token reads"
  on public.school_mobile_registration_tokens
  for select
  using (false);

drop policy if exists "No direct registration token inserts" on public.school_mobile_registration_tokens;
create policy "No direct registration token inserts"
  on public.school_mobile_registration_tokens
  for insert
  with check (false);

drop policy if exists "No direct registration token updates" on public.school_mobile_registration_tokens;
create policy "No direct registration token updates"
  on public.school_mobile_registration_tokens
  for update
  using (false)
  with check (false);

drop policy if exists "No direct registration token deletes" on public.school_mobile_registration_tokens;
create policy "No direct registration token deletes"
  on public.school_mobile_registration_tokens
  for delete
  using (false);

revoke all on table public.school_mobile_directory from anon, authenticated;
revoke all on table public.school_mobile_registration_tokens from anon, authenticated;

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
     and is_active = true
   limit 1;

  if v_row.id is null then
    raise exception 'School code not found';
  end if;

  return jsonb_build_object(
    'school_code', v_row.school_code,
    'school_name', v_row.school_name,
    'supabase_url', v_row.supabase_url,
    'supabase_anon_key', v_row.supabase_anon_key,
    'school_id', v_row.school_id
  );
end;
$$;

grant execute on function public.lookup_school_mobile_config(text) to anon, authenticated;

create or replace function public.register_school_mobile_config(
  p_registration_token text,
  p_school_name text,
  p_supabase_url text,
  p_supabase_anon_key text,
  p_school_id text,
  p_school_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token_ok boolean;
  v_code text;
  v_prefix text;
  v_existing public.school_mobile_directory%rowtype;
begin
  select exists (
    select 1
      from public.school_mobile_registration_tokens
     where token_hash = encode(digest(coalesce(p_registration_token, ''), 'sha256'), 'hex')
       and is_active = true
       and (expires_at is null or expires_at > now())
  ) into v_token_ok;

  if not v_token_ok then
    raise exception 'Invalid or expired registration token';
  end if;

  if nullif(trim(p_school_name), '') is null then
    raise exception 'School name is required';
  end if;

  if nullif(trim(p_supabase_url), '') is null
     or nullif(trim(p_supabase_anon_key), '') is null
     or nullif(trim(p_school_id), '') is null then
    raise exception 'Supabase URL, anon key and school ID are required';
  end if;

  select *
    into v_existing
    from public.school_mobile_directory
   where school_id = trim(p_school_id)
   limit 1;

  if v_existing.id is not null then
    update public.school_mobile_directory
       set school_name = trim(p_school_name),
           supabase_url = trim(p_supabase_url),
           supabase_anon_key = trim(p_supabase_anon_key),
           is_active = true,
           updated_at = now()
     where id = v_existing.id
     returning school_code into v_code;
  else
    v_code := upper(nullif(trim(p_school_code), ''));

    if v_code is null then
      v_prefix := upper(regexp_replace(trim(p_school_name), '[^A-Za-z0-9]', '', 'g'));
      v_prefix := substring(coalesce(nullif(v_prefix, ''), 'SCH') from 1 for 5);

      loop
        v_code := v_prefix || '-' || upper(substring(encode(gen_random_bytes(3), 'hex') from 1 for 6));
        exit when not exists (
          select 1 from public.school_mobile_directory where school_code = v_code
        );
      end loop;
    end if;

    insert into public.school_mobile_directory
      (school_code, school_name, supabase_url, supabase_anon_key, school_id)
    values
      (v_code, trim(p_school_name), trim(p_supabase_url), trim(p_supabase_anon_key), trim(p_school_id));
  end if;

  return public.lookup_school_mobile_config(v_code);
end;
$$;

grant execute on function public.register_school_mobile_config(text, text, text, text, text, text) to anon, authenticated;

-- Example:
-- 1) Create a revocable registration token in your central Supabase.
--    Keep the plain token private. Put only the hash in this table.
-- insert into public.school_mobile_registration_tokens (token_name, token_hash)
-- values ('Desktop setup token', encode(digest('replace-with-a-long-random-token', 'sha256'), 'hex'));
--
-- 2) Manual directory insert remains possible if needed:
-- insert into public.school_mobile_directory
--   (school_code, school_name, supabase_url, supabase_anon_key, school_id)
-- values
--   ('OTERK-7F3K', 'Oterkpolu School', 'https://your-school-project.supabase.co', 'your-school-anon-key', 'your-school-id');
