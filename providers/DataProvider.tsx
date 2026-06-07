import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { ASSESSMENT_GROUPS, CURRENT_YEAR, GRADING_SCALE, SCORE_COMPONENTS, SUBJECTS } from "../constants/school";
import { demoAttendance, demoScores, demoStudents } from "../lib/demoData";
import { makeAttendanceId, makeMobileStudentId, makeScoreId, nowISO, todayISO } from "../lib/ids";
import { DEMO_CACHE_KEY, makeDataCacheKey } from "../lib/cacheKeys";
import { AssessmentGroup, AttendanceMark, AttendanceRecord, GradingScaleItem, ScoreComponent, SessionContext, Student, StudentDraft, SubjectScore } from "../types";
import { useSupabase } from "./SupabaseProvider";

type DataContextValue = {
  session: SessionContext;
  setSession: (next: Partial<SessionContext>) => void;
  students: Student[];
  subjects: string[];
  scoreComponents: ScoreComponent[];
  assessmentGroups: Record<string, AssessmentGroup>;
  gradingScale: GradingScaleItem[];
  attendanceTermStartDates: Record<string, string>;
  scores: SubjectScore[];
  attendance: AttendanceRecord[];
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncedAt: string | null;
  lastSyncError: string | null;
  refresh: () => Promise<void>;
  seedDemoData: () => Promise<void>;
  saveStudent: (draft: StudentDraft) => Promise<Student>;
  deleteStudent: (studentId: string) => Promise<void>;
  upsertAttendance: (studentId: string, date: string, mark: AttendanceMark) => Promise<void>;
  bulkAttendance: (date: string, mark: AttendanceMark) => Promise<AttendanceRecord[]>;
  replaceAttendance: (records: AttendanceRecord[]) => Promise<void>;
  upsertScore: (studentId: string, subject: string, field: string, value: number | null) => Promise<void>;
};

const DataContext = createContext<DataContextValue | null>(null);
const SCORE_CONFLICT_TARGET = "school_id,student_id,academic_year,term,subject";
const ATTENDANCE_CONFLICT_TARGET = "school_id,student_id,academic_year,term,attendance_date";
const PENDING_SYNC_SUFFIX = ":pending-sync-v1";

type PendingChange =
  | {
      id: string;
      entity: "attendance";
      action: "upsert" | "delete";
      school_id: string;
      record: AttendanceRecord;
      updated_at: string;
    }
  | {
      id: string;
      entity: "score";
      action: "upsert" | "delete";
      school_id: string;
      record: SubjectScore;
      updated_at: string;
    }
  | {
      id: string;
      entity: "student";
      action: "upsert" | "delete";
      school_id: string;
      record: Student;
      updated_at: string;
    };

function sameScorePeriod(record: SubjectScore, studentId: string, academicYear: string, term: string, subject: string) {
  return record.student_id === studentId && record.academic_year === academicYear && record.term === term && record.subject === subject;
}

function sameAttendancePeriod(record: AttendanceRecord, studentId: string, academicYear: string, term: string, date: string) {
  return record.student_id === studentId && record.academic_year === academicYear && record.term === term && record.attendance_date === date;
}

function parseTime(value?: string | null) {
  if (!value) return 0;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : 0;
}

function pendingIsNewerOrEqual(localUpdatedAt: string, cloudUpdatedAt?: string | null) {
  return parseTime(localUpdatedAt) >= parseTime(cloudUpdatedAt);
}

function pendingAttendanceId(schoolId: string, studentId: string, academicYear: string, term: string, date: string) {
  return `attendance|${schoolId}|${studentId}|${academicYear}|${term}|${date}`;
}

function pendingScoreId(schoolId: string, studentId: string, academicYear: string, term: string, subject: string) {
  return `score|${schoolId}|${studentId}|${academicYear}|${term}|${subject}`;
}

function pendingStudentId(schoolId: string, studentId: string) {
  return `student|${schoolId}|${studentId}`;
}

function applyPendingStudents(cloudStudents: Student[], pending: PendingChange[], session: SessionContext) {
  let next = [...cloudStudents];
  for (const change of pending) {
    if (change.entity !== "student" || change.school_id !== session.school_id) continue;
    const local = change.record;
    if (local.academic_year !== session.academic_year || local.grade !== session.grade || local.section !== session.section) continue;
    const existing = next.find((student) => student.student_id === local.student_id);
    if (!pendingIsNewerOrEqual(change.updated_at, existing?.updated_at)) continue;
    next = next.filter((student) => student.student_id !== local.student_id);
    if (change.action === "upsert" && !local.is_deleted) next.push(local);
  }
  return next.sort((a, b) => a.student_name.localeCompare(b.student_name));
}

function applyPendingScores(cloudScores: SubjectScore[], pending: PendingChange[], session: SessionContext) {
  let next = [...cloudScores];
  for (const change of pending) {
    if (change.entity !== "score" || change.school_id !== session.school_id) continue;
    const local = change.record;
    if (local.academic_year !== session.academic_year || local.term !== session.term) continue;
    const existing = next.find((score) => sameScorePeriod(score, local.student_id, local.academic_year, local.term, local.subject));
    if (!pendingIsNewerOrEqual(change.updated_at, existing?.updated_at)) continue;
    next = next.filter((score) => !sameScorePeriod(score, local.student_id, local.academic_year, local.term, local.subject));
    if (change.action === "upsert" && Object.keys(local.scores).length) next.push(local);
  }
  return next;
}

function applyPendingAttendance(cloudAttendance: AttendanceRecord[], pending: PendingChange[], session: SessionContext) {
  let next = [...cloudAttendance];
  for (const change of pending) {
    if (change.entity !== "attendance" || change.school_id !== session.school_id) continue;
    const local = change.record;
    if (local.academic_year !== session.academic_year || local.term !== session.term) continue;
    const existing = next.find((record) => sameAttendancePeriod(record, local.student_id, local.academic_year, local.term, local.attendance_date));
    if (!pendingIsNewerOrEqual(change.updated_at, existing?.updated_at)) continue;
    next = next.filter((record) => !sameAttendancePeriod(record, local.student_id, local.academic_year, local.term, local.attendance_date));
    if (change.action === "upsert" && local.mark) next.push(local);
  }
  return next;
}

function parseSetting<T>(value: unknown, fallback: T): T {
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return (value ?? fallback) as T;
}

function normalizeSubjects(value: unknown) {
  const raw = parseSetting<unknown>(value, null);
  if (!Array.isArray(raw)) return [];
  const subjects = raw
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (item && typeof item === "object") {
        const record = item as Record<string, unknown>;
        return String(record.name ?? record.label ?? record.subject ?? "").trim();
      }
      return "";
    })
    .filter(Boolean);
  return subjects;
}

function normalizeScoreComponents(value: unknown) {
  const raw = parseSetting<unknown>(value, null);
  if (!Array.isArray(raw)) return [];
  const components = raw
    .map((item) => {
      if (typeof item === "string") {
        const field = item.trim();
        return field ? { field, label: field, max: 100, group: "class_group" } : null;
      }
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const field = String(record.field ?? record.label ?? "").trim();
      if (!field) return null;
      return {
        field,
        label: String(record.label ?? field).trim(),
        max: Number(record.max ?? 0),
        group: String(record.group ?? "class_group"),
      };
    })
    .filter((item): item is ScoreComponent => Boolean(item));
  return components;
}

function normalizeAssessmentGroups(value: unknown) {
  const raw = parseSetting<unknown>(value, null);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const groups = Object.fromEntries(
    Object.entries(raw as Record<string, any>).map(([key, group]) => [
      key,
      {
        name: String(group?.name ?? key),
        weight: Number(group?.weight ?? 0),
        components: Array.isArray(group?.components) ? group.components.map(String) : [],
      },
    ]),
  ) as Record<string, AssessmentGroup>;
  return groups;
}

function normalizeGradingScale(value: unknown) {
  const raw = parseSetting<unknown>(value, null);
  if (!Array.isArray(raw)) return [];
  const scale = raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      return {
        min: Number(record.min ?? 0),
        max: Number(record.max ?? 0),
        grade: (record.grade ?? "-") as number | string,
        remark: String(record.remark ?? ""),
      };
    })
    .filter((item): item is GradingScaleItem => Boolean(item));
  return scale;
}

export function DataProvider({ children }: PropsWithChildren) {
  const { client, config } = useSupabase();
  const [session, setSessionState] = useState<SessionContext>({
    school_id: config.schoolId,
    academic_year: CURRENT_YEAR,
    term: "First Term",
    grade: "JHS 1",
    section: "A",
  });
  const [students, setStudents] = useState<Student[]>([]);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [scoreComponents, setScoreComponents] = useState<ScoreComponent[]>([]);
  const [assessmentGroups, setAssessmentGroups] = useState<Record<string, AssessmentGroup>>({});
  const [gradingScale, setGradingScale] = useState<GradingScaleItem[]>([]);
  const [attendanceTermStartDates, setAttendanceTermStartDates] = useState<Record<string, string>>({});
  const [scores, setScores] = useState<SubjectScore[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [isSyncing, setSyncing] = useState(false);
  const [isOnline, setOnline] = useState(Boolean(client));
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [lastSyncError, setLastSyncError] = useState<string | null>(null);

  useEffect(() => {
    setSessionState((prev) => ({ ...prev, school_id: config.schoolId }));
  }, [config.schoolId]);

  const cacheKey = client ? makeDataCacheKey(session.school_id) : DEMO_CACHE_KEY;

  const cache = useCallback(async (payload: Partial<Pick<DataContextValue, "students" | "subjects" | "scores" | "attendance" | "scoreComponents" | "assessmentGroups" | "gradingScale" | "attendanceTermStartDates">>) => {
    const raw = await AsyncStorage.getItem(cacheKey);
    const previous = raw ? JSON.parse(raw) as Record<string, unknown> : {};
    await AsyncStorage.setItem(cacheKey, JSON.stringify({ ...previous, ...payload }));
  }, [cacheKey]);
  const pendingKey = `${cacheKey}${PENDING_SYNC_SUFFIX}`;

  const loadPendingChanges = useCallback(async () => {
    const raw = await AsyncStorage.getItem(pendingKey);
    if (!raw) return [] as PendingChange[];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed as PendingChange[] : [];
    } catch {
      return [] as PendingChange[];
    }
  }, [pendingKey]);

  const savePendingChanges = useCallback(async (changes: PendingChange[]) => {
    if (changes.length) await AsyncStorage.setItem(pendingKey, JSON.stringify(changes));
    else await AsyncStorage.removeItem(pendingKey);
  }, [pendingKey]);

  const enqueuePendingChange = useCallback(async (change: PendingChange) => {
    const pending = await loadPendingChanges();
    const next = [...pending.filter((item) => item.id !== change.id), change];
    await savePendingChanges(next);
  }, [loadPendingChanges, savePendingChanges]);

  const removePendingChange = useCallback(async (id: string) => {
    const pending = await loadPendingChanges();
    await savePendingChanges(pending.filter((item) => item.id !== id));
  }, [loadPendingChanges, savePendingChanges]);

  const flushPendingChanges = useCallback(async () => {
    if (!client) return false;
    const pending = await loadPendingChanges();
    if (!pending.length) return true;

    const remaining: PendingChange[] = [];
    for (const change of pending) {
      try {
        if (change.entity === "attendance") {
          const record = change.record;
          const cloud = await client
            .from("daily_attendance")
            .select("updated_at")
            .eq("school_id", change.school_id)
            .eq("student_id", record.student_id)
            .eq("academic_year", record.academic_year)
            .eq("term", record.term)
            .eq("attendance_date", record.attendance_date)
            .maybeSingle();
          if (cloud.error) throw cloud.error;
          if (pendingIsNewerOrEqual(change.updated_at, cloud.data?.updated_at)) {
            const result = change.action === "upsert" && record.mark
              ? await client.from("daily_attendance").upsert(
                { ...record, school_id: change.school_id },
                { onConflict: ATTENDANCE_CONFLICT_TARGET },
              )
              : await client
                .from("daily_attendance")
                .delete()
                .eq("school_id", change.school_id)
                .eq("student_id", record.student_id)
                .eq("academic_year", record.academic_year)
                .eq("term", record.term)
                .eq("attendance_date", record.attendance_date);
            if (result.error) throw result.error;
          }
        } else if (change.entity === "score") {
          const record = change.record;
          const cloud = await client
            .from("student_scores")
            .select("updated_at")
            .eq("school_id", change.school_id)
            .eq("student_id", record.student_id)
            .eq("academic_year", record.academic_year)
            .eq("term", record.term)
            .eq("subject", record.subject)
            .maybeSingle();
          if (cloud.error) throw cloud.error;
          if (pendingIsNewerOrEqual(change.updated_at, cloud.data?.updated_at)) {
            const result = change.action === "upsert" && Object.keys(record.scores).length
              ? await client.from("student_scores").upsert(
                { ...record, scores: JSON.stringify(record.scores), school_id: change.school_id },
                { onConflict: SCORE_CONFLICT_TARGET },
              )
              : await client
                .from("student_scores")
                .delete()
                .eq("school_id", change.school_id)
                .eq("student_id", record.student_id)
                .eq("academic_year", record.academic_year)
                .eq("term", record.term)
                .eq("subject", record.subject);
            if (result.error) throw result.error;
          }
        } else if (change.entity === "student") {
          const record = change.record;
          const cloud = await client
            .from("students")
            .select("updated_at")
            .eq("school_id", change.school_id)
            .eq("student_id", record.student_id)
            .maybeSingle();
          if (cloud.error) throw cloud.error;
          if (pendingIsNewerOrEqual(change.updated_at, cloud.data?.updated_at)) {
            const result = change.action === "upsert"
              ? await client.from("students").upsert(
                { ...record, school_id: change.school_id },
                { onConflict: "student_id" },
              )
              : await client
                .from("students")
                .update({ is_deleted: true, updated_at: change.updated_at })
                .eq("student_id", record.student_id)
                .eq("school_id", change.school_id);
            if (result.error) throw result.error;
          }
        }
      } catch {
        remaining.push(change);
      }
    }

    await savePendingChanges(remaining);
    return remaining.length === 0;
  }, [client, loadPendingChanges, savePendingChanges]);

  useEffect(() => {
    AsyncStorage.getItem(cacheKey).then((raw) => {
      if (!raw) {
        setStudents([]);
        setScores([]);
        setAttendance([]);
        setSubjects([]);
        setScoreComponents([]);
        setAssessmentGroups({});
        setGradingScale([]);
        setAttendanceTermStartDates({});
        return;
      }
      const cached = JSON.parse(raw) as {
        students?: Student[];
        scores?: SubjectScore[];
        attendance?: AttendanceRecord[];
        subjects?: string[];
        scoreComponents?: ScoreComponent[];
        assessmentGroups?: Record<string, AssessmentGroup>;
        gradingScale?: GradingScaleItem[];
        attendanceTermStartDates?: Record<string, string>;
      };
      if (cached.students?.length) setStudents(cached.students);
      if (cached.subjects?.length) setSubjects(cached.subjects);
      if (cached.scoreComponents?.length) setScoreComponents(cached.scoreComponents);
      if (cached.assessmentGroups) setAssessmentGroups(cached.assessmentGroups);
      if (cached.gradingScale?.length) setGradingScale(cached.gradingScale);
      if (cached.attendanceTermStartDates) setAttendanceTermStartDates(cached.attendanceTermStartDates);
      if (cached.scores) setScores(cached.scores);
      if (cached.attendance) setAttendance(cached.attendance);
    });
  }, [cacheKey, client]);

  const refresh = useCallback(async () => {
    if (!client) {
      setOnline(false);
      return;
    }
    setSyncing(true);
    try {
      const pendingFlushed = await flushPendingChanges();
      let activeSession = session;
      let studentRes = await client
        .from("students")
        .select("*")
        .eq("school_id", activeSession.school_id)
        .eq("academic_year", activeSession.academic_year)
        .eq("grade", activeSession.grade)
        .eq("section", activeSession.section)
        .eq("is_deleted", false)
        .order("student_name");
      if (studentRes.error) throw studentRes.error;

      if (!studentRes.data?.length) {
        const fallbackByYear = await client
          .from("students")
          .select("*")
          .eq("school_id", session.school_id)
          .eq("academic_year", session.academic_year)
          .eq("is_deleted", false)
          .order("grade")
          .order("section")
          .order("student_name");
        if (fallbackByYear.error) throw fallbackByYear.error;
        const first = fallbackByYear.data?.[0];
        if (first?.grade && first?.section) {
          activeSession = { ...activeSession, grade: first.grade, section: first.section };
          studentRes = {
            ...fallbackByYear,
            data: (fallbackByYear.data ?? []).filter((student: Student) => student.grade === first.grade && student.section === first.section),
          };
        }
      }

      if (!studentRes.data?.length) {
        const fallbackAnyYear = await client
          .from("students")
          .select("*")
          .eq("school_id", session.school_id)
          .eq("is_deleted", false)
          .order("academic_year", { ascending: false })
          .order("grade")
          .order("section")
          .order("student_name");
        if (fallbackAnyYear.error) throw fallbackAnyYear.error;
        const first = fallbackAnyYear.data?.[0];
        if (first?.academic_year && first?.grade && first?.section) {
          activeSession = { ...activeSession, academic_year: first.academic_year, grade: first.grade, section: first.section };
          studentRes = {
            ...fallbackAnyYear,
            data: (fallbackAnyYear.data ?? []).filter((student: Student) =>
              student.academic_year === first.academic_year &&
              student.grade === first.grade &&
              student.section === first.section
            ),
          };
        }
      }

      if (
        activeSession.academic_year !== session.academic_year ||
        activeSession.grade !== session.grade ||
        activeSession.section !== session.section
      ) {
        setSessionState((prev) => ({ ...prev, ...activeSession }));
      }

      const [scoreRes, attendanceRes, settingsRes] = await Promise.all([
        client
          .from("student_scores")
          .select("*")
          .eq("school_id", activeSession.school_id)
          .eq("academic_year", activeSession.academic_year)
          .eq("term", activeSession.term),
        client
          .from("daily_attendance")
          .select("*")
          .eq("school_id", activeSession.school_id)
          .eq("academic_year", activeSession.academic_year)
          .eq("term", activeSession.term),
        client
          .from("school_settings")
          .select("subjects,score_components,assessment_groups,grading_scale,attendance_term_start_dates,settings")
          .eq("school_id", activeSession.school_id)
          .maybeSingle(),
      ]);
      if (scoreRes.error || attendanceRes.error) {
        throw scoreRes.error ?? attendanceRes.error;
      }
      const pending = await loadPendingChanges();
      const nextStudentsRaw = (studentRes.data ?? []) as Student[];
      const nextScores = (scoreRes.data ?? []).map((row: any) => ({
        ...row,
        scores: typeof row.scores === "string" ? JSON.parse(row.scores || "{}") : row.scores ?? {},
      })) as SubjectScore[];
      const nextAttendanceRaw = (attendanceRes.data ?? []) as AttendanceRecord[];
      const nextStudents = applyPendingStudents(nextStudentsRaw, pending, activeSession);
      const nextScoresWithPending = applyPendingScores(nextScores, pending, activeSession);
      const nextAttendance = applyPendingAttendance(nextAttendanceRaw, pending, activeSession);
      const settings = settingsRes.data as any;
      const nextSubjects = normalizeSubjects(settings?.subjects ?? settings?.settings?.subjects);
      const nextComponents = normalizeScoreComponents(settings?.score_components ?? settings?.settings?.score_components);
      const nextGroups = normalizeAssessmentGroups(settings?.assessment_groups ?? settings?.settings?.assessment_groups);
      const nextGrading = normalizeGradingScale(settings?.grading_scale ?? settings?.settings?.grading_scale);
      const nextTermStarts = parseSetting<Record<string, string>>(settings?.attendance_term_start_dates ?? settings?.settings?.attendance_term_start_dates, {});
      setStudents(nextStudents);
      setSubjects(nextSubjects);
      setScoreComponents(nextComponents);
      setAssessmentGroups(nextGroups);
      setGradingScale(nextGrading);
      setAttendanceTermStartDates(nextTermStarts);
      setScores(nextScoresWithPending);
      setAttendance(nextAttendance);
      setOnline(pendingFlushed);
      setLastSyncError(pendingFlushed ? null : "Some offline changes are pending upload.");
      const syncedAt = nowISO();
      setLastSyncedAt(syncedAt);
      await cache({ students: nextStudents, subjects: nextSubjects, scoreComponents: nextComponents, assessmentGroups: nextGroups, gradingScale: nextGrading, attendanceTermStartDates: nextTermStarts, scores: nextScoresWithPending, attendance: nextAttendance });
    } catch (error) {
      setOnline(false);
      setLastSyncError(error instanceof Error ? error.message : "Sync failed.");
    } finally {
      setSyncing(false);
    }
  }, [cache, client, flushPendingChanges, loadPendingChanges, session]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const setSession = useCallback((next: Partial<SessionContext>) => {
    setSessionState((prev) => ({ ...prev, ...next }));
  }, []);

  const seedDemoData = useCallback(async () => {
    if (client) return;
    setStudents(demoStudents);
    setSubjects(SUBJECTS);
    setScoreComponents(SCORE_COMPONENTS);
    setAssessmentGroups(ASSESSMENT_GROUPS);
    setGradingScale(GRADING_SCALE);
    setAttendanceTermStartDates({});
    setScores(demoScores);
    setAttendance(demoAttendance);
    setLastSyncError(null);
    await cache({
      students: demoStudents,
      subjects: SUBJECTS,
      scoreComponents: SCORE_COMPONENTS,
      assessmentGroups: ASSESSMENT_GROUPS,
      gradingScale: GRADING_SCALE,
      attendanceTermStartDates: {},
      scores: demoScores,
      attendance: demoAttendance,
    });
  }, [cache, client]);

  const saveStudent = useCallback(
    async (draft: StudentDraft) => {
      const studentId = draft.student_id || makeMobileStudentId();
      const student: Student = {
        student_id: studentId,
        student_name: draft.student_name.trim(),
        gender: draft.gender || "",
        admission_number: draft.admission_number?.trim(),
        parent_name: draft.parent_name?.trim(),
        parent_contact: draft.parent_contact?.trim(),
        house: draft.house?.trim(),
        grade: session.grade,
        section: session.section,
        academic_year: session.academic_year,
        is_deleted: false,
        updated_at: nowISO(),
      };
      setStudents((prev) => {
        const rest = prev.filter((item) => item.student_id !== studentId);
        return [...rest, student].sort((a, b) => a.student_name.localeCompare(b.student_name));
      });
      const nextStudents = [...students.filter((item) => item.student_id !== studentId), student].sort((a, b) => a.student_name.localeCompare(b.student_name));
      await cache({ students: nextStudents });
      const pendingId = pendingStudentId(session.school_id, studentId);
      if (client) {
        const result = await client.from("students").upsert(
          { ...student, school_id: session.school_id },
          { onConflict: "student_id" },
        );
        if (result.error) {
          await enqueuePendingChange({ id: pendingId, entity: "student", action: "upsert", school_id: session.school_id, record: student, updated_at: student.updated_at ?? nowISO() });
          setOnline(false);
          setLastSyncError(result.error.message);
        } else {
          await removePendingChange(pendingId);
          setOnline(true);
          setLastSyncError(null);
        }
      }
      return student;
    },
    [cache, client, enqueuePendingChange, removePendingChange, session, students],
  );

  const deleteStudent = useCallback(
    async (studentId: string) => {
      const updatedAt = nowISO();
      const existing = students.find((student) => student.student_id === studentId);
      const tombstone: Student = {
        ...(existing ?? {
          student_id: studentId,
          student_name: "",
          gender: "",
          grade: session.grade,
          section: session.section,
          academic_year: session.academic_year,
        }),
        is_deleted: true,
        updated_at: updatedAt,
      };
      setStudents((prev) => prev.filter((student) => student.student_id !== studentId));
      await cache({ students: students.filter((student) => student.student_id !== studentId) });
      const pendingId = pendingStudentId(session.school_id, studentId);
      if (client) {
        const result = await client
          .from("students")
          .update({ is_deleted: true, updated_at: updatedAt })
          .eq("student_id", studentId)
          .eq("school_id", session.school_id);
        if (result.error) {
          await enqueuePendingChange({ id: pendingId, entity: "student", action: "delete", school_id: session.school_id, record: tombstone, updated_at: updatedAt });
          setOnline(false);
          setLastSyncError(result.error.message);
        } else {
          await removePendingChange(pendingId);
          setOnline(true);
          setLastSyncError(null);
        }
      }
    },
    [cache, client, enqueuePendingChange, removePendingChange, session, students],
  );

  const upsertAttendance = useCallback(
    async (studentId: string, date: string, mark: AttendanceMark) => {
      const student = students.find((item) => item.student_id === studentId);
      const record: AttendanceRecord = {
        attendance_id: makeAttendanceId(session.school_id, studentId, session.academic_year, session.term, date),
        student_id: studentId,
        student_name: student?.student_name,
        academic_year: session.academic_year,
        term: session.term,
        attendance_date: date,
        mark,
        updated_at: nowISO(),
      };
      const nextAttendance = (() => {
        const rest = attendance.filter((item) => !sameAttendancePeriod(item, studentId, session.academic_year, session.term, date));
        return mark ? [...rest, record] : rest;
      })();
      setAttendance(nextAttendance);
      await cache({ attendance: nextAttendance });
      const pendingId = pendingAttendanceId(session.school_id, studentId, session.academic_year, session.term, date);
      const pendingAction: "upsert" | "delete" = mark ? "upsert" : "delete";
      if (client) {
        const result = mark
          ? await client.from("daily_attendance").upsert(
            { ...record, school_id: session.school_id },
            { onConflict: ATTENDANCE_CONFLICT_TARGET },
          )
          : await client
            .from("daily_attendance")
            .delete()
            .eq("school_id", session.school_id)
            .eq("student_id", studentId)
            .eq("academic_year", session.academic_year)
            .eq("term", session.term)
            .eq("attendance_date", date);
        if (result.error) {
          await enqueuePendingChange({ id: pendingId, entity: "attendance", action: pendingAction, school_id: session.school_id, record, updated_at: record.updated_at });
          setLastSyncError(result.error.message);
          setOnline(false);
          return;
        }
        await removePendingChange(pendingId);
        setOnline(true);
        setLastSyncError(null);
      }
    },
    [attendance, cache, client, enqueuePendingChange, removePendingChange, session, students],
  );

  const bulkAttendance = useCallback(
    async (date: string, mark: AttendanceMark) => {
      const before = attendance;
      for (const student of students) {
        await upsertAttendance(student.student_id, date, mark);
      }
      return before;
    },
    [attendance, students, upsertAttendance],
  );

  const replaceAttendance = useCallback(
    async (records: AttendanceRecord[]) => {
      const previousIds = new Set(records.map((record) => record.attendance_id));
      const removed = attendance.filter((record) => !previousIds.has(record.attendance_id));
      setAttendance(records);
      await cache({ attendance: records });
      if (client) {
        if (records.length) {
          const result = await client.from("daily_attendance").upsert(
            records.map((record) => ({ ...record, school_id: session.school_id })),
            { onConflict: ATTENDANCE_CONFLICT_TARGET },
          );
          if (result.error) {
            for (const record of records) {
              await enqueuePendingChange({
                id: pendingAttendanceId(session.school_id, record.student_id, record.academic_year, record.term, record.attendance_date),
                entity: "attendance",
                action: "upsert",
                school_id: session.school_id,
                record,
                updated_at: record.updated_at,
              });
            }
            setOnline(false);
            setLastSyncError(result.error.message);
          } else {
            for (const record of records) {
              await removePendingChange(pendingAttendanceId(session.school_id, record.student_id, record.academic_year, record.term, record.attendance_date));
            }
          }
        }
        if (removed.length) {
          const result = await client.from("daily_attendance").delete().in(
            "attendance_id",
            removed.map((record) => record.attendance_id),
          );
          if (result.error) {
            for (const record of removed) {
              const tombstone = { ...record, mark: "" as AttendanceMark, updated_at: nowISO() };
              await enqueuePendingChange({
                id: pendingAttendanceId(session.school_id, record.student_id, record.academic_year, record.term, record.attendance_date),
                entity: "attendance",
                action: "delete",
                school_id: session.school_id,
                record: tombstone,
                updated_at: tombstone.updated_at,
              });
            }
            setOnline(false);
            setLastSyncError(result.error.message);
          } else {
            for (const record of removed) {
              await removePendingChange(pendingAttendanceId(session.school_id, record.student_id, record.academic_year, record.term, record.attendance_date));
            }
          }
        }
      }
    },
    [attendance, cache, client, enqueuePendingChange, removePendingChange, session.school_id],
  );

  const upsertScore = useCallback(
    async (studentId: string, subject: string, field: string, value: number | null) => {
      const student = students.find((item) => item.student_id === studentId);
      const scoreId = makeScoreId(session.school_id, studentId, session.academic_year, session.term, subject);
      const existing = scores.find((item) => sameScorePeriod(item, studentId, session.academic_year, session.term, subject));
      const nextScores = { ...(existing?.scores ?? {}) };
      if (value === null) delete nextScores[field];
      else nextScores[field] = value;
      const nextRecord: SubjectScore = {
        score_id: scoreId,
        student_id: studentId,
        student_name: student?.student_name,
        academic_year: session.academic_year,
        term: session.term,
        subject,
        scores: nextScores,
        updated_at: nowISO(),
      };
      const nextScoreRows = (() => {
        const rest = scores.filter((item) => !sameScorePeriod(item, studentId, session.academic_year, session.term, subject));
        return Object.keys(nextScores).length ? [...rest, nextRecord] : rest;
      })();
      setScores(nextScoreRows);
      await cache({ scores: nextScoreRows });
      const pendingId = pendingScoreId(session.school_id, studentId, session.academic_year, session.term, subject);
      const pendingAction: "upsert" | "delete" = Object.keys(nextScores).length ? "upsert" : "delete";
      if (client) {
        const result = Object.keys(nextScores).length
          ? await client.from("student_scores").upsert(
            { ...nextRecord, scores: JSON.stringify(nextRecord.scores), school_id: session.school_id },
            { onConflict: SCORE_CONFLICT_TARGET },
          )
          : await client
            .from("student_scores")
            .delete()
            .eq("school_id", session.school_id)
            .eq("student_id", studentId)
            .eq("academic_year", session.academic_year)
            .eq("term", session.term)
            .eq("subject", subject);
        if (result.error) {
          await enqueuePendingChange({ id: pendingId, entity: "score", action: pendingAction, school_id: session.school_id, record: nextRecord, updated_at: nextRecord.updated_at });
          setLastSyncError(result.error.message);
          setOnline(false);
          return;
        }
        await removePendingChange(pendingId);
        setOnline(true);
        setLastSyncError(null);
      }
    },
    [cache, client, enqueuePendingChange, removePendingChange, scores, session, students],
  );

  const value = useMemo<DataContextValue>(
    () => ({
      session,
      setSession,
      students,
      subjects,
      scoreComponents,
      assessmentGroups,
      gradingScale,
      attendanceTermStartDates,
      scores,
      attendance,
      isOnline,
      isSyncing,
      lastSyncedAt,
      lastSyncError,
      refresh,
      seedDemoData,
      saveStudent,
      deleteStudent,
      upsertAttendance,
      bulkAttendance,
      replaceAttendance,
      upsertScore,
    }),
    [assessmentGroups, attendance, attendanceTermStartDates, bulkAttendance, deleteStudent, gradingScale, isOnline, isSyncing, lastSyncError, lastSyncedAt, refresh, replaceAttendance, saveStudent, scoreComponents, scores, seedDemoData, session, setSession, students, subjects, upsertAttendance, upsertScore],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used inside DataProvider");
  return ctx;
}
