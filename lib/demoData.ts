import { AttendanceRecord, MobileUser, Student, SubjectScore } from "../types";
import { CURRENT_YEAR } from "../constants/school";

export const demoUser: MobileUser = {
  user_id: "demo-admin",
  full_name: "Administrator",
  username: "admin",
  role: "admin",
  permissions: {
    manage_students: true,
    mark_attendance: true,
    enter_scores: true,
    view_analytics: true,
    export_pdf: true,
    manage_settings: true,
    manage_users: true,
  },
};

export const demoStudents: Student[] = [
  {
    student_id: "stu-ama",
    student_name: "Ama Mensah",
    gender: "Female",
    admission_number: "ADM-001",
    house: "Blue",
    parent_name: "Mrs. Mensah",
    parent_contact: "0240000001",
    grade: "JHS 1",
    section: "A",
    academic_year: CURRENT_YEAR,
    days_present: 42,
    total_school_days: 46,
    is_deleted: false,
  },
  {
    student_id: "stu-kojo",
    student_name: "Kojo Tetteh",
    gender: "Male",
    admission_number: "ADM-002",
    house: "Green",
    parent_name: "Mr. Tetteh",
    parent_contact: "0240000002",
    grade: "JHS 1",
    section: "A",
    academic_year: CURRENT_YEAR,
    days_present: 40,
    total_school_days: 46,
    is_deleted: false,
  },
  {
    student_id: "stu-efua",
    student_name: "Efua Owusu",
    gender: "Female",
    admission_number: "ADM-003",
    house: "Red",
    parent_name: "Mrs. Owusu",
    parent_contact: "0240000003",
    grade: "JHS 1",
    section: "A",
    academic_year: CURRENT_YEAR,
    days_present: 45,
    total_school_days: 46,
    is_deleted: false,
  },
];

export const demoScores: SubjectScore[] = [
  {
    score_id: "score-ama-math",
    student_id: "stu-ama",
    academic_year: CURRENT_YEAR,
    term: "First Term",
    subject: "Mathematics",
    scores: { "CLASS TEST 1": 13, "CLASS TEST 2": 14, "GROUP WORK": 8, "PROJECT WORK": 17, "EXAM SCORE": 82 },
    updated_at: new Date().toISOString(),
  },
  {
    score_id: "score-kojo-math",
    student_id: "stu-kojo",
    academic_year: CURRENT_YEAR,
    term: "First Term",
    subject: "Mathematics",
    scores: { "CLASS TEST 1": 11, "CLASS TEST 2": 10, "GROUP WORK": 7, "PROJECT WORK": 15, "EXAM SCORE": 76 },
    updated_at: new Date().toISOString(),
  },
];

export const demoAttendance: AttendanceRecord[] = [];
