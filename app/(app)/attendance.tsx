import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Card, EmptyState, SectionHeader } from "../../components/ui";
import { colors, radius, spacing } from "../../constants/theme";
import { todayISO } from "../../lib/ids";
import { useData } from "../../providers/DataProvider";
import { AttendanceMark, AttendanceRecord } from "../../types";

const weekLabels = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const markCycle: AttendanceMark[] = ["", "P", "A", "L", "H"];
const markStyles: Record<Exclude<AttendanceMark, "">, { bg: string; border: string; text: string }> = {
  P: { bg: "#ECFDF5", border: "#34D399", text: "#047857" },
  A: { bg: "#FEF2F2", border: "#F87171", text: "#B91C1C" },
  L: { bg: "#EFF6FF", border: "#60A5FA", text: "#1D4ED8" },
  H: { bg: "#FFF7ED", border: "#FDBA74", text: "#9A3412" },
};

function parseISODate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function toISODate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(value: string, days: number) {
  const date = parseISODate(value);
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

function startOfWeek(value: string) {
  const date = parseISODate(value);
  const day = date.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + offset);
  return toISODate(date);
}

function shortDate(value: string) {
  return parseISODate(value).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function nextMark(mark: AttendanceMark) {
  const current = markCycle.indexOf(mark);
  return markCycle[(current + 1) % markCycle.length];
}

function calendarWeekLabel(weekStart: string) {
  const currentWeek = startOfWeek(todayISO());
  const delta = Math.round((parseISODate(weekStart).getTime() - parseISODate(currentWeek).getTime()) / 604800000);
  if (delta === 0) return "This week";
  if (delta === -1) return "Last week";
  if (delta === 1) return "Next week";
  return `${shortDate(weekStart)} - ${shortDate(addDays(weekStart, 4))}`;
}

export default function AttendanceScreen() {
  const { students, attendance, attendanceTermStartDates, session, upsertAttendance, replaceAttendance } = useData();
  const [weekStart, setWeekStart] = useState(startOfWeek(todayISO()));
  const autoPickedWeek = useRef(false);
  const [undoStack, setUndoStack] = useState<AttendanceRecord[][]>([]);
  const [busy, setBusy] = useState(false);

  const termKey = `${session.academic_year}|${session.term}`;
  const termWeekStart = useMemo(
    () => startOfWeek(attendanceTermStartDates[termKey] || todayISO()),
    [attendanceTermStartDates, termKey],
  );
  const weekDates = useMemo(() => weekLabels.map((_, index) => addDays(weekStart, index)), [weekStart]);
  const weekNumber = Math.max(1, Math.floor((parseISODate(weekStart).getTime() - parseISODate(termWeekStart).getTime()) / 604800000) + 1);

  const recordsByCell = useMemo(() => {
    const weekSet = new Set(weekDates);
    const map = new Map<string, AttendanceRecord>();
    attendance.forEach((record) => {
      if (weekSet.has(record.attendance_date)) {
        map.set(`${record.student_id}|${record.attendance_date}`, record);
      }
    });
    return map;
  }, [attendance, weekDates]);

  const markedCount = useMemo(() => {
    let count = 0;
    recordsByCell.forEach((record) => {
      if (record.mark) count += 1;
    });
    return count;
  }, [recordsByCell]);

  useEffect(() => {
    if (attendanceTermStartDates[termKey]) {
      setWeekStart(termWeekStart);
      autoPickedWeek.current = true;
    }
  }, [attendanceTermStartDates, termKey, termWeekStart]);

  useEffect(() => {
    if (autoPickedWeek.current || !attendance.length) return;
    if (weekDates.some((date) => attendance.some((record) => record.attendance_date === date))) return;
    const latestDate = attendance
      .map((record) => record.attendance_date)
      .filter(Boolean)
      .sort()
      .at(-1);
    if (latestDate) {
      autoPickedWeek.current = true;
      setWeekStart(startOfWeek(latestDate));
    }
  }, [attendance, weekDates]);

  const shiftWeek = (weeks: number) => setWeekStart((current) => addDays(current, weeks * 7));

  const markSingle = async (studentId: string, date: string) => {
    const selected = recordsByCell.get(`${studentId}|${date}`)?.mark ?? "";
    setUndoStack((prev) => [...prev, attendance]);
    await upsertAttendance(studentId, date, nextMark(selected));
  };

  const markWeekPresent = async () => {
    setBusy(true);
    setUndoStack((prev) => [...prev, attendance]);
    for (const student of students) {
      for (const date of weekDates) {
        await upsertAttendance(student.student_id, date, "P");
      }
    }
    setBusy(false);
  };

  const clearWeek = async () => {
    setBusy(true);
    setUndoStack((prev) => [...prev, attendance]);
    for (const record of Array.from(recordsByCell.values())) {
      await upsertAttendance(record.student_id, record.attendance_date, "");
    }
    setBusy(false);
  };

  const undo = async () => {
    const previous = undoStack[undoStack.length - 1];
    if (!previous) return;
    await replaceAttendance(previous);
    setUndoStack((prev) => prev.slice(0, -1));
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <SectionHeader title="Attendance" detail={`${markedCount}/${students.length * weekDates.length} marked`} />
      <Card style={styles.toolbar}>
        <View style={styles.navRow}>
          <Pressable onPress={() => shiftWeek(-1)} style={styles.arrowButton}>
            <Text style={styles.arrowText}>{"<"}</Text>
          </Pressable>
          <View style={styles.weekLabel}>
            <Text style={styles.weekText}>{calendarWeekLabel(weekStart)}</Text>
            <Text style={styles.weekMeta}>{shortDate(weekDates[0])} - {shortDate(weekDates[4])}</Text>
          </View>
          <Pressable onPress={() => shiftWeek(1)} style={styles.arrowButton}>
            <Text style={styles.arrowText}>{">"}</Text>
          </Pressable>
        </View>
        <View style={styles.navRow}>
          <Pressable onPress={() => shiftWeek(-1)} style={styles.arrowButton}>
            <Text style={styles.arrowText}>{"<"}</Text>
          </Pressable>
          <View style={styles.termWeekButton}>
            <Text style={styles.weekText}>Week {weekNumber}</Text>
            <Text style={styles.weekMeta}>from term start</Text>
          </View>
          <Pressable onPress={() => shiftWeek(1)} style={styles.arrowButton}>
            <Text style={styles.arrowText}>{">"}</Text>
          </Pressable>
        </View>
        <View style={styles.actionRow}>
          <Pressable disabled={busy || !students.length} onPress={markWeekPresent} style={[styles.primaryButton, (busy || !students.length) && styles.disabled]}>
            <Text style={styles.primaryText}>Mark week P</Text>
          </Pressable>
          <Pressable disabled={busy || !markedCount} onPress={clearWeek} style={[styles.secondaryButton, (busy || !markedCount) && styles.disabled]}>
            <Text style={styles.secondaryText}>Clear week</Text>
          </Pressable>
          <Pressable disabled={!undoStack.length} onPress={undo} style={[styles.secondaryButton, !undoStack.length && styles.disabled]}>
            <Text style={styles.secondaryText}>Undo</Text>
          </Pressable>
        </View>
      </Card>

      {students.length ? (
        <View style={styles.list}>
          <View style={styles.dayGridHeader}>
            {weekDates.map((date, index) => (
              <View key={date} style={styles.dayHeader}>
                <Text style={styles.headerText}>{weekLabels[index]}</Text>
                <Text style={styles.dateHeader}>{shortDate(date)}</Text>
              </View>
            ))}
          </View>
            {students.map((student) => (
              <Card key={student.student_id} style={styles.tableRow}>
                <View style={styles.studentCell}>
                  <Text style={styles.name}>{student.student_name}</Text>
                  <Text style={styles.meta}>{student.admission_number ?? student.student_id}</Text>
                </View>
                <View style={styles.dayGrid}>
                  {weekDates.map((date) => {
                    const mark = recordsByCell.get(`${student.student_id}|${date}`)?.mark ?? "";
                    const style = mark ? markStyles[mark] : null;
                    return (
                      <Pressable
                        key={`${student.student_id}-${date}`}
                        onPress={() => markSingle(student.student_id, date)}
                        style={[
                          styles.markCell,
                          style ? { backgroundColor: style.bg, borderColor: style.border } : null,
                        ]}
                      >
                        <Text style={[styles.markText, style ? { color: style.text } : null]}>{mark || "-"}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </Card>
            ))}
        </View>
      ) : (
        <EmptyState title="No students" body="Pick a class that has active students." />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg, padding: spacing.lg, paddingBottom: 96 },
  toolbar: { gap: spacing.md },
  navRow: { alignItems: "center", flexDirection: "row", gap: spacing.sm },
  arrowButton: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    justifyContent: "center",
    height: 42,
    width: 42,
  },
  arrowText: { color: colors.text, fontSize: 18, fontWeight: "800" },
  weekLabel: { alignItems: "center", flex: 1, gap: 2, minWidth: 130 },
  weekText: { color: colors.text, fontSize: 16, fontWeight: "700", textAlign: "center" },
  weekMeta: { color: colors.muted, fontSize: 11, textAlign: "center" },
  termWeekButton: {
    alignItems: "center",
    backgroundColor: colors.cardAlt,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    flex: 1,
    gap: 2,
    justifyContent: "center",
    minHeight: 42,
  },
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    justifyContent: "center",
    minHeight: 42,
    paddingHorizontal: spacing.md,
  },
  primaryText: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },
  secondaryButton: {
    backgroundColor: colors.cardAlt,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 42,
    paddingHorizontal: spacing.md,
  },
  secondaryText: { color: colors.text, fontSize: 13, fontWeight: "600" },
  disabled: { opacity: 0.45 },
  list: { gap: spacing.sm },
  dayGridHeader: { flexDirection: "row", gap: 4, paddingHorizontal: spacing.sm },
  dayHeader: {
    alignItems: "center",
    backgroundColor: colors.cardAlt,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    gap: 2,
    flex: 1,
    justifyContent: "center",
    minHeight: 42,
    minWidth: 0,
  },
  headerText: { color: colors.text, fontSize: 12, fontWeight: "700" },
  dateHeader: { color: colors.muted, fontSize: 9, fontWeight: "500" },
  tableRow: { gap: spacing.sm, padding: spacing.sm },
  studentCell: { justifyContent: "center", minHeight: 34 },
  name: { color: colors.text, fontSize: 14, fontWeight: "700" },
  meta: { color: colors.muted, fontSize: 11, fontWeight: "400" },
  dayGrid: { flexDirection: "row", gap: 4 },
  markCell: {
    alignItems: "center",
    backgroundColor: colors.bg,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    flex: 1,
    height: 42,
    justifyContent: "center",
    minWidth: 0,
  },
  markText: { color: colors.muted, fontSize: 15, fontWeight: "800" },
});
