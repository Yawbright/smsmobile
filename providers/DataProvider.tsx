import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { ASSESSMENT_GROUPS, CURRENT_YEAR, GRADING_SCALE, SCORE_COMPONENTS } from "../constants/school";
import { demoAttendance, demoScores, demoStudents } from "../lib/demoData";
import { makeAttendanceId, makeMobileStudentId, makeScoreId, nowISO, todayISO } from "../lib/ids";
import { DEMO_CACHE_KEY, makeDataCacheKey } from "../lib/cacheKeys";
import { AssessmentGroup, AttendanceMark, AttendanceRecord, GradingScaleItem, ScoreComponent, SessionContext, Student, StudentDraft, SubjectScore } from "../types";
import { useSupabase } from "./SupabaseProvider";

type DataContextValue = {
  session: SessionContext;
  setSession: (next: Partial<SessionContext>) => void;
  students: Student[];
  scoreComponents: ScoreComponent[];
  assessmentGroups: Record<string, AssessmentGroup>;
  gradingScale: GradingScaleItem[];
  scores: SubjectScore[];
  attendance: AttendanceRecord[];
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncedAt: string | null;
  refresh: () => Promise<void>;
  saveStudent: (draft: StudentDraft) => Promise<Student>;
  deleteStudent: (studentId: string) => Promise<void>;
  upsertAttendance: (studentId: string, date: string, mark: AttendanceMark) => Promise<void>;
  bulkAttendance: (date: string, mark: AttendanceMark) => Promise<AttendanceRecord[]>;
  replaceAttendance: (records: AttendanceRecord[]) => Promise<void>;
  upsertScore: (studentId: string, subject: string, field: string, value: number | null) => Promise<void>;
};

const DataContext = createContext<DataContextValue | null>(null);

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

export function DataProvider({ children }: PropsWithChildren) {
  const { client, config } = useSupabase();
  const [session, setSessionState] = useState<SessionContext>({
    school_id: config.schoolId,
    academic_year: CURRENT_YEAR,
    term: "First Term",
    grade: "JHS 1",
    section: "A",
  });
  const [students, setStudents] = useState<Student[]>(demoStudents);
  const [scoreComponents, setScoreComponents] = useState<ScoreComponent[]>(SCORE_COMPONENTS);
  const [assessmentGroups, setAssessmentGroups] = useState<Record<string, AssessmentGroup>>(ASSESSMENT_GROUPS);
  const [gradingScale, setGradingScale] = useState<GradingScaleItem[]>(GRADING_SCALE);
  const [scores, setScores] = useState<SubjectScore[]>(demoScores);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>(demoAttendance);
  const [isSyncing, setSyncing] = useState(false);
  const [isOnline, setOnline] = useState(Boolean(client));
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  useEffect(() => {
    setSessionState((prev) => ({ ...prev, school_id: config.schoolId }));
  }, [config.schoolId]);

  const cacheKey = client ? makeDataCacheKey(session.school_id) : DEMO_CACHE_KEY;

  const cache = useCallback(async (payload: Partial<Pick<DataContextValue, "students" | "scores" | "attendance" | "scoreComponents" | "assessmentGroups" | "gradingScale">>) => {
    await AsyncStorage.setItem(cacheKey, JSON.stringify(payload));
  }, [cacheKey]);

  useEffect(() => {
    AsyncStorage.getItem(cacheKey).then((raw) => {
      if (!raw) {
        if (!client) {
          setStudents(demoStudents);
          setScores(demoScores);
          setAttendance(demoAttendance);
          setScoreComponents(SCORE_COMPONENTS);
          setAssessmentGroups(ASSESSMENT_GROUPS);
          setGradingScale(GRADING_SCALE);
        } else {
          setStudents([]);
          setScores([]);
          setAttendance([]);
        }
        return;
      }
      const cached = JSON.parse(raw) as {
        students?: Student[];
        scores?: SubjectScore[];
        attendance?: AttendanceRecord[];
        scoreComponents?: ScoreComponent[];
        assessmentGroups?: Record<string, AssessmentGroup>;
        gradingScale?: GradingScaleItem[];
      };
      if (cached.students?.length) setStudents(cached.students);
      if (cached.scoreComponents?.length) setScoreComponents(cached.scoreComponents);
      if (cached.assessmentGroups) setAssessmentGroups(cached.assessmentGroups);
      if (cached.gradingScale?.length) setGradingScale(cached.gradingScale);
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
          .select("score_components,assessment_groups,grading_scale,settings")
          .eq("school_id", activeSession.school_id)
          .maybeSingle(),
      ]);
      if (scoreRes.error || attendanceRes.error) {
        throw scoreRes.error ?? attendanceRes.error;
      }
      const nextStudents = (studentRes.data ?? []) as Student[];
      const nextScores = (scoreRes.data ?? []).map((row: any) => ({
        ...row,
        scores: typeof row.scores === "string" ? JSON.parse(row.scores || "{}") : row.scores ?? {},
      })) as SubjectScore[];
      const nextAttendance = (attendanceRes.data ?? []) as AttendanceRecord[];
      const settings = settingsRes.data as any;
      const rawComponents = parseSetting<unknown>(settings?.score_components ?? settings?.settings?.score_components, null);
      const rawGroups = parseSetting<unknown>(settings?.assessment_groups ?? settings?.settings?.assessment_groups, null);
      const rawGrading = parseSetting<unknown>(settings?.grading_scale ?? settings?.settings?.grading_scale, null);
      const nextComponents = Array.isArray(rawComponents) && rawComponents.length ? rawComponents as ScoreComponent[] : SCORE_COMPONENTS;
      const nextGroups = rawGroups && typeof rawGroups === "object" ? rawGroups as Record<string, AssessmentGroup> : ASSESSMENT_GROUPS;
      const nextGrading = Array.isArray(rawGrading) && rawGrading.length ? rawGrading as GradingScaleItem[] : GRADING_SCALE;
      setStudents(nextStudents);
      setScoreComponents(nextComponents);
      setAssessmentGroups(nextGroups);
      setGradingScale(nextGrading);
      setScores(nextScores);
      setAttendance(nextAttendance);
      setOnline(true);
      const syncedAt = nowISO();
      setLastSyncedAt(syncedAt);
      await cache({ students: nextStudents, scoreComponents: nextComponents, assessmentGroups: nextGroups, gradingScale: nextGrading, scores: nextScores, attendance: nextAttendance });
    } catch {
      setOnline(false);
    } finally {
      setSyncing(false);
    }
  }, [cache, client, session]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const setSession = useCallback((next: Partial<SessionContext>) => {
    setSessionState((prev) => ({ ...prev, ...next }));
  }, []);

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
      await cache({
        students: [...students.filter((item) => item.student_id !== studentId), student].sort((a, b) => a.student_name.localeCompare(b.student_name)),
      });
      if (client) {
        await client.from("students").upsert(
          { ...student, school_id: session.school_id },
          { onConflict: "student_id" },
        );
      }
      return student;
    },
    [cache, client, session, students],
  );

  const deleteStudent = useCallback(
    async (studentId: string) => {
      const updatedAt = nowISO();
      setStudents((prev) => prev.filter((student) => student.student_id !== studentId));
      await cache({ students: students.filter((student) => student.student_id !== studentId) });
      if (client) {
        await client
          .from("students")
          .update({ is_deleted: true, updated_at: updatedAt })
          .eq("student_id", studentId)
          .eq("school_id", session.school_id);
      }
    },
    [cache, client, session.school_id, students],
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
      setAttendance((prev) => {
        const rest = prev.filter((item) => item.attendance_id !== record.attendance_id);
        return mark ? [...rest, record] : rest;
      });
      if (client) {
        await client.from("daily_attendance").upsert(
          { ...record, school_id: session.school_id },
          { onConflict: "attendance_id" },
        );
      }
    },
    [client, session, students],
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
      if (client) {
        if (records.length) {
          await client.from("daily_attendance").upsert(
            records.map((record) => ({ ...record, school_id: session.school_id })),
            { onConflict: "attendance_id" },
          );
        }
        if (removed.length) {
          await client.from("daily_attendance").delete().in(
            "attendance_id",
            removed.map((record) => record.attendance_id),
          );
        }
      }
    },
    [attendance, client, session.school_id],
  );

  const upsertScore = useCallback(
    async (studentId: string, subject: string, field: string, value: number | null) => {
      const student = students.find((item) => item.student_id === studentId);
      const scoreId = makeScoreId(session.school_id, studentId, session.academic_year, session.term, subject);
      const existing = scores.find((item) => item.score_id === scoreId);
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
      setScores((prev) => {
        const rest = prev.filter((item) => item.score_id !== scoreId);
        return Object.keys(nextScores).length ? [...rest, nextRecord] : rest;
      });
      if (client) {
        if (Object.keys(nextScores).length) {
          await client.from("student_scores").upsert(
            { ...nextRecord, scores: JSON.stringify(nextRecord.scores), school_id: session.school_id },
            { onConflict: "score_id" },
          );
        } else {
          await client.from("student_scores").delete().eq("score_id", scoreId);
        }
      }
    },
    [client, scores, session, students],
  );

  const value = useMemo<DataContextValue>(
    () => ({
      session,
      setSession,
      students,
      scoreComponents,
      assessmentGroups,
      gradingScale,
      scores,
      attendance,
      isOnline,
      isSyncing,
      lastSyncedAt,
      refresh,
      saveStudent,
      deleteStudent,
      upsertAttendance,
      bulkAttendance,
      replaceAttendance,
      upsertScore,
    }),
    [assessmentGroups, attendance, bulkAttendance, deleteStudent, gradingScale, isOnline, isSyncing, lastSyncedAt, refresh, replaceAttendance, saveStudent, scoreComponents, scores, session, setSession, students, upsertAttendance, upsertScore],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used inside DataProvider");
  return ctx;
}
