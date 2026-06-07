import { ASSESSMENT_GROUPS, GRADING_SCALE, SUBJECTS } from "../constants/school";
import { AssessmentGroup, AttendanceRecord, GradingScaleItem, ScoreComponent, Student, SubjectScore } from "../types";

export type ReportSubjectRow = {
  subject: string;
  classScore: number;
  examScore: number;
  total: number;
  grade: string;
  remark: string;
  hasScore: boolean;
};

export type StudentReportPreview = {
  student: Student;
  subjectRows: ReportSubjectRow[];
  total: number;
  average: number;
  subjectsScored: number;
  attendancePresent: number;
  attendanceTotal: number;
  attendancePercent: number;
};

type BuildReportInput = {
  student: Student;
  scores: SubjectScore[];
  attendance: AttendanceRecord[];
  scoreComponents: ScoreComponent[];
  subjects?: string[];
  assessmentGroups?: Record<string, AssessmentGroup>;
  gradingScale?: GradingScaleItem[];
};

export function buildStudentReportPreview({
  student,
  scores,
  attendance,
  scoreComponents,
  subjects = SUBJECTS,
  assessmentGroups = ASSESSMENT_GROUPS,
  gradingScale = GRADING_SCALE,
}: BuildReportInput): StudentReportPreview {
  const subjectRows = subjects.map((subject) => {
    const scoreRecord = scores.find((item) => item.student_id === student.student_id && item.subject === subject);
    return calculateSubjectRow(subject, scoreRecord, scoreComponents, assessmentGroups, gradingScale);
  });
  const scoredRows = subjectRows.filter((row) => row.hasScore);
  const total = round1(scoredRows.reduce((sum, row) => sum + row.total, 0));
  const average = scoredRows.length ? round1(total / scoredRows.length) : 0;
  const studentAttendance = attendance.filter((item) => item.student_id === student.student_id);
  const attendancePresent = studentAttendance.filter((item) => item.mark === "P").length;
  const attendanceTotal = studentAttendance.length;
  const attendancePercent = attendanceTotal ? Math.round((attendancePresent / attendanceTotal) * 100) : 0;

  return {
    student,
    subjectRows,
    total,
    average,
    subjectsScored: scoredRows.length,
    attendancePresent,
    attendanceTotal,
    attendancePercent,
  };
}

function calculateSubjectRow(
  subject: string,
  scoreRecord: SubjectScore | undefined,
  scoreComponents: ScoreComponent[],
  assessmentGroups: Record<string, AssessmentGroup>,
  gradingScale: GradingScaleItem[],
): ReportSubjectRow {
  const classScore = calculateGroupScore("class_group", scoreRecord, scoreComponents, assessmentGroups);
  const examScore = calculateGroupScore("exam_group", scoreRecord, scoreComponents, assessmentGroups);
  const hasScore = scoreComponents.some((component) => getScoreValue(scoreRecord, component) !== undefined);
  const total = round1(classScore + examScore);
  const gradeInfo = getGrade(total, gradingScale);

  return {
    subject,
    classScore,
    examScore,
    total,
    grade: hasScore ? String(gradeInfo.grade) : "-",
    remark: hasScore ? gradeInfo.remark : "-",
    hasScore,
  };
}

function calculateGroupScore(
  groupKey: string,
  scoreRecord: SubjectScore | undefined,
  scoreComponents: ScoreComponent[],
  assessmentGroups: Record<string, AssessmentGroup>,
) {
  const components = scoreComponents.filter((component) => component.group === groupKey);
  const rawTotal = components.reduce((sum, component) => sum + (getScoreValue(scoreRecord, component) ?? 0), 0);
  const maxTotal = components.reduce((sum, component) => sum + Number(component.max || 0), 0);
  const weight = Number(assessmentGroups[groupKey]?.weight ?? 0);
  if (!maxTotal || !weight) return 0;
  return round1((rawTotal / maxTotal) * weight);
}

function getScoreValue(scoreRecord: SubjectScore | undefined, component: ScoreComponent) {
  if (!scoreRecord) return undefined;
  const scores = scoreRecord.scores ?? {};
  const keys = [
    component.field,
    component.label,
    `${component.label} (${component.max})`,
    `${component.field} (${component.max})`,
  ];
  for (const key of keys) {
    const value = scores[key];
    if (value !== undefined && value !== null) return Number(value);
  }
  return undefined;
}

function getGrade(total: number, gradingScale: GradingScaleItem[]) {
  return (
    gradingScale.find((item) => total >= Number(item.min) && total <= Number(item.max)) ??
    gradingScale[gradingScale.length - 1] ??
    { grade: "-", remark: "-" }
  );
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}
