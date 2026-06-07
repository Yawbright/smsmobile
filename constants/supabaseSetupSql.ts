export const SUPABASE_SETUP_SQL = `create extension if not exists pgcrypto;

create table if not exists public.school_settings (
  school_id text primary key,
  school_code text,
  school_name text,
  settings jsonb,
  subjects jsonb,
  conduct_options jsonb,
  talents_options jsonb,
  class_remarks jsonb,
  head_remarks jsonb,
  grading_scale jsonb,
  department_options jsonb,
  house_options jsonb,
  assessment_groups jsonb,
  score_components jsonb,
  role_permissions jsonb,
  attendance_term_start_dates jsonb,
  subjects_updated_at timestamptz,
  conduct_options_updated_at timestamptz,
  talents_options_updated_at timestamptz,
  class_remarks_updated_at timestamptz,
  head_remarks_updated_at timestamptz,
  grading_scale_updated_at timestamptz,
  department_options_updated_at timestamptz,
  house_options_updated_at timestamptz,
  assessment_groups_updated_at timestamptz,
  score_components_updated_at timestamptz,
  role_permissions_updated_at timestamptz,
  attendance_term_start_dates_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.students (
  student_id text primary key,
  school_id text not null,
  student_name text not null default '',
  gender text,
  days_present integer not null default 0,
  total_school_days integer not null default 0,
  date_of_birth text,
  admission_number text,
  admission_date text,
  house text,
  department text,
  parent_name text,
  parent_contact text,
  conduct text,
  talents_interests text,
  class_teacher_remark text,
  head_teacher_remark text,
  grade text not null default '',
  stream text not null default '',
  academic_year text not null default '',
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.student_scores (
  score_id text primary key,
  school_id text not null,
  student_id text,
  student_name text,
  academic_year text not null default '',
  term text not null default '',
  subject text not null default '',
  scores jsonb not null default '{}'::jsonb,
  class_test1 integer not null default 0,
  class_test2 integer not null default 0,
  group_work integer not null default 0,
  project_work integer not null default 0,
  exam_score integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.daily_attendance (
  attendance_id text primary key,
  school_id text not null,
  student_id text,
  student_name text,
  academic_year text not null default '',
  term text not null default '',
  attendance_date text not null default '',
  mark text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.school_users (
  user_id text primary key,
  school_id text not null default '',
  full_name text not null default '',
  username text not null,
  password_hash text not null default '',
  role text not null default 'class_teacher',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subject_teachers (
  assignment_id text primary key,
  school_id text not null default '',
  user_id text not null default '',
  teacher_name text not null default '',
  subject text not null default '',
  grade text not null default '',
  stream text not null default '',
  academic_year text not null default '',
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.student_scores
  add column if not exists score_id text;

alter table public.student_scores
  add column if not exists student_id text;

alter table public.student_scores
  add column if not exists scores jsonb not null default '{}'::jsonb;

alter table public.daily_attendance
  add column if not exists attendance_id text;

alter table public.daily_attendance
  add column if not exists student_id text;

alter table public.school_settings
  add column if not exists school_code text;

alter table public.school_settings
  add column if not exists school_name text;

alter table public.school_settings
  add column if not exists subjects jsonb;

alter table public.school_settings
  add column if not exists conduct_options jsonb;

alter table public.school_settings
  add column if not exists talents_options jsonb;

alter table public.school_settings
  add column if not exists class_remarks jsonb;

alter table public.school_settings
  add column if not exists head_remarks jsonb;

alter table public.school_settings
  add column if not exists grading_scale jsonb;

alter table public.school_settings
  add column if not exists department_options jsonb;

alter table public.school_settings
  add column if not exists house_options jsonb;

alter table public.school_settings
  add column if not exists assessment_groups jsonb;

alter table public.school_settings
  add column if not exists score_components jsonb;

alter table public.school_settings
  add column if not exists role_permissions jsonb;

alter table public.school_settings
  add column if not exists attendance_term_start_dates jsonb;

alter table public.school_settings
  add column if not exists subjects_updated_at timestamptz;

alter table public.school_settings
  add column if not exists conduct_options_updated_at timestamptz;

alter table public.school_settings
  add column if not exists talents_options_updated_at timestamptz;

alter table public.school_settings
  add column if not exists class_remarks_updated_at timestamptz;

alter table public.school_settings
  add column if not exists head_remarks_updated_at timestamptz;

alter table public.school_settings
  add column if not exists grading_scale_updated_at timestamptz;

alter table public.school_settings
  add column if not exists department_options_updated_at timestamptz;

alter table public.school_settings
  add column if not exists house_options_updated_at timestamptz;

alter table public.school_settings
  add column if not exists assessment_groups_updated_at timestamptz;

alter table public.school_settings
  add column if not exists score_components_updated_at timestamptz;

alter table public.school_settings
  add column if not exists role_permissions_updated_at timestamptz;

alter table public.school_settings
  add column if not exists attendance_term_start_dates_updated_at timestamptz;

alter table public.students
  add column if not exists admission_number text;

alter table public.students
  add column if not exists admission_date text;

alter table public.students
  add column if not exists department text;

alter table public.students
  add column if not exists stream text not null default '';

do $$
begin
  if exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'students'
       and column_name = 'section'
  ) then
    update public.students
       set stream = section
     where (stream is null or stream = '')
       and section is not null
       and section <> '';
  end if;
end $$;

alter table public.students
  drop column if exists section;

alter table public.school_users
  add column if not exists school_id text not null default '';

alter table public.subject_teachers
  add column if not exists school_id text not null default '';

alter table public.subject_teachers
  add column if not exists stream text not null default '';

do $$
begin
  if exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'subject_teachers'
       and column_name = 'section'
  ) then
    update public.subject_teachers
       set stream = section
     where (stream is null or stream = '')
       and section is not null
       and section <> '';
  end if;
end $$;

alter table public.subject_teachers
  drop column if exists section;

create unique index if not exists uq_mobile_school_settings_school_id
  on public.school_settings (school_id);

create index if not exists idx_mobile_students_school_class
  on public.students (school_id, academic_year, grade, stream);

create index if not exists idx_mobile_scores_school_period
  on public.student_scores (school_id, academic_year, term);

create index if not exists idx_mobile_attendance_school_period
  on public.daily_attendance (school_id, academic_year, term);

create index if not exists idx_mobile_school_users_school
  on public.school_users (school_id);

create unique index if not exists uq_mobile_school_users_school_username
  on public.school_users (school_id, lower(username));

create index if not exists idx_mobile_subject_teachers_school
  on public.subject_teachers (school_id, academic_year, grade, stream);

update public.student_scores
   set score_id = school_id || '|score|' || student_id || '|' || academic_year || '|' || term || '|' || subject
 where (score_id is null or score_id = '')
   and student_id is not null;

update public.daily_attendance
   set attendance_id = school_id || '|attendance|' || student_id || '|' || academic_year || '|' || term || '|' || attendance_date
 where (attendance_id is null or attendance_id = '')
   and student_id is not null;

create unique index if not exists uq_mobile_student_scores_score_id
  on public.student_scores (score_id)
  where score_id is not null;

create unique index if not exists uq_mobile_daily_attendance_attendance_id
  on public.daily_attendance (attendance_id)
  where attendance_id is not null;

update public.school_settings
   set score_components = settings -> 'score_components'
 where score_components is null
   and settings ? 'score_components';

update public.school_settings
   set assessment_groups = settings -> 'assessment_groups'
 where assessment_groups is null
   and settings ? 'assessment_groups';

update public.school_settings
   set grading_scale = settings -> 'grading_scale'
 where grading_scale is null
   and settings ? 'grading_scale';

drop index if exists uq_mobile_student_scores_student_period_subject;
create unique index if not exists uq_mobile_student_scores_student_period_subject
  on public.student_scores (school_id, student_id, academic_year, term, subject);

drop index if exists uq_mobile_daily_attendance_student_period_date;
create unique index if not exists uq_mobile_daily_attendance_student_period_date
  on public.daily_attendance (school_id, student_id, academic_year, term, attendance_date);

alter table public.school_settings enable row level security;
alter table public.students enable row level security;
alter table public.student_scores enable row level security;
alter table public.daily_attendance enable row level security;
alter table public.school_users enable row level security;
alter table public.subject_teachers enable row level security;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on table public.school_settings to anon, authenticated;
grant select, insert, update, delete on table public.students to anon, authenticated;
grant select, insert, update, delete on table public.student_scores to anon, authenticated;
grant select, insert, update, delete on table public.daily_attendance to anon, authenticated;
grant select, insert, update, delete on table public.school_users to anon, authenticated;
grant select, insert, update, delete on table public.subject_teachers to anon, authenticated;

drop policy if exists "School app can sync settings" on public.school_settings;
create policy "School app can sync settings"
  on public.school_settings
  for all
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "School app can sync students" on public.students;
create policy "School app can sync students"
  on public.students
  for all
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "School app can sync scores" on public.student_scores;
create policy "School app can sync scores"
  on public.student_scores
  for all
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "School app can sync attendance" on public.daily_attendance;
create policy "School app can sync attendance"
  on public.daily_attendance
  for all
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "School app can sync users" on public.school_users;
create policy "School app can sync users"
  on public.school_users
  for all
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "School app can sync subject teachers" on public.subject_teachers;
create policy "School app can sync subject teachers"
  on public.subject_teachers
  for all
  to anon, authenticated
  using (true)
  with check (true);

create or replace function public.mobile_login(p_username text, p_password text, p_school_id text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user record;
  v_role text;
  v_perms jsonb;
  v_school_id text;
begin
  select *
    into v_user
    from public.school_users
   where lower(username) = lower(trim(p_username))
     and (p_school_id is null or school_id = p_school_id)
   limit 1;

  if v_user is null then
    raise exception 'Invalid username or password';
  end if;

  if coalesce(v_user.is_active, true) = false then
    raise exception 'User account is inactive';
  end if;

  if coalesce(v_user.password_hash, '') <> encode(digest(p_password, 'sha256'), 'hex') then
    raise exception 'Invalid username or password';
  end if;

  v_role := coalesce(v_user.role, 'class_teacher');
  v_school_id := coalesce(p_school_id, v_user.school_id);

  select role_permissions -> v_role
    into v_perms
    from public.school_settings
   where school_id = v_school_id
   limit 1;

  return jsonb_build_object(
    'user_id', coalesce(v_user.user_id::text, v_user.username::text),
    'full_name', coalesce(v_user.full_name, v_user.username),
    'username', v_user.username,
    'role', v_role,
    'permissions', jsonb_build_object(
      'manage_students', case when v_role = 'admin' then true else coalesce(v_perms ->> 'manage_students', case when v_role in ('head_teacher', 'class_teacher') then 'Full Access' else 'Not Allowed' end) <> 'Not Allowed' end,
      'mark_attendance', case when v_role = 'admin' then true else coalesce(v_perms ->> 'mark_attendance', case when v_role in ('head_teacher', 'class_teacher') then 'Full Access' else 'Not Allowed' end) <> 'Not Allowed' end,
      'enter_scores', case when v_role = 'admin' then true else coalesce(v_perms ->> 'enter_scores', case when v_role in ('head_teacher', 'class_teacher', 'subject_teacher') then 'All Subjects' else 'Not Allowed' end) <> 'Not Allowed' end,
      'view_analytics', case when v_role = 'admin' then true else coalesce(v_perms ->> 'view_analytics', case when v_role = 'head_teacher' then 'Full Access' else 'Not Allowed' end) <> 'Not Allowed' end,
      'export_pdf', case when v_role = 'admin' then true else coalesce(v_perms ->> 'export_pdf', case when v_role = 'head_teacher' then 'Full Access' else 'Not Allowed' end) <> 'Not Allowed' end,
      'manage_settings', case when v_role = 'admin' then true else coalesce(v_perms ->> 'manage_settings', 'Not Allowed') <> 'Not Allowed' end,
      'manage_users', case when v_role = 'admin' then true else coalesce(v_perms ->> 'manage_users', 'Not Allowed') <> 'Not Allowed' end
    )
  );
end;
$$;

grant execute on function public.mobile_login(text, text, text) to anon, authenticated;
`;
