export type Role = "admin" | "head_teacher" | "class_teacher" | "subject_teacher";

export type PermissionKey =
  | "manage_students"
  | "mark_attendance"
  | "enter_scores"
  | "view_analytics"
  | "export_pdf"
  | "manage_settings"
  | "manage_users";

export type MobileUser = {
  user_id: string;
  full_name: string;
  username?: string;
  role: Role;
  permissions: Record<PermissionKey, boolean>;
};

export type SessionContext = {
  school_id: string;
  academic_year: string;
  term: string;
  grade: string;
  section: string;
};

export type Student = {
  student_id: string;
  student_name: string;
  gender: "Male" | "Female" | string;
  admission_number?: string;
  house?: string;
  department?: string;
  parent_name?: string;
  parent_contact?: string;
  grade: string;
  section: string;
  academic_year: string;
  days_present?: number;
  total_school_days?: number;
  is_deleted?: boolean;
  updated_at?: string;
};

export type StudentDraft = {
  student_id?: string;
  student_name: string;
  gender: string;
  admission_number?: string;
  parent_name?: string;
  parent_contact?: string;
  house?: string;
  department?: string;
};

export type ScoreComponent = {
  field: string;
  label: string;
  max: number;
  group: "class_group" | "exam_group" | string;
};

export type AssessmentGroup = {
  name: string;
  weight: number;
  components?: string[];
};

export type GradingScaleItem = {
  min: number;
  max: number;
  grade: number | string;
  remark: string;
};

export type SubjectScore = {
  score_id: string;
  student_id: string;
  student_name?: string;
  academic_year: string;
  term: string;
  subject: string;
  scores: Record<string, number>;
  updated_at: string;
};

export type AttendanceMark = "P" | "A" | "L" | "H" | "";

export type AttendanceRecord = {
  attendance_id: string;
  student_id: string;
  student_name?: string;
  academic_year: string;
  term: string;
  attendance_date: string;
  mark: AttendanceMark;
  updated_at: string;
};
