export const SUPABASE_SETUP_SQL = `create extension if not exists pgcrypto;


alter table public.student_scores
  add column if not exists score_id text;

alter table public.student_scores
  add column if not exists student_id text;

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
create unique index if not exists uq_mobile_school_settings_school_id
  on public.school_settings (school_id);
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

create unique index if not exists uq_mobile_student_scores_student_period_subject
  on public.student_scores (student_id, academic_year, term, subject)
  where student_id is not null;

create unique index if not exists uq_mobile_daily_attendance_student_period_date
  on public.daily_attendance (student_id, academic_year, term, attendance_date)
  where student_id is not null;

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

