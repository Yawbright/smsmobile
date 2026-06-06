export function makeScoreId(
  schoolId: string,
  studentId: string,
  academicYear: string,
  term: string,
  subject: string,
) {
  return `${schoolId}|score|${studentId}|${academicYear}|${term}|${subject}`;
}

export function makeAttendanceId(
  schoolId: string,
  studentId: string,
  academicYear: string,
  term: string,
  date: string,
) {
  return `${schoolId}|attendance|${studentId}|${academicYear}|${term}|${date}`;
}

export function makeMobileStudentId() {
  const randomPart =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  return `mob-stu-${randomPart}`;
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function nowISO() {
  return new Date().toISOString();
}
