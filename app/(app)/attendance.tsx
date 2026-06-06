import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Card, Chip, EmptyState, SectionHeader } from "../../components/ui";
import { colors, radius, spacing } from "../../constants/theme";
import { todayISO } from "../../lib/ids";
import { useData } from "../../providers/DataProvider";
import { AttendanceMark, AttendanceRecord } from "../../types";

const marks: { mark: AttendanceMark; label: string }[] = [
  { mark: "P", label: "P" },
  { mark: "A", label: "A" },
  { mark: "L", label: "L" },
  { mark: "H", label: "H" },
];

export default function AttendanceScreen() {
  const { students, attendance, upsertAttendance, bulkAttendance, replaceAttendance } = useData();
  const [date, setDate] = useState(todayISO());
  const [undoStack, setUndoStack] = useState<AttendanceRecord[][]>([]);
  const [busy, setBusy] = useState(false);

  const recordsByStudent = useMemo(() => {
    const map = new Map<string, AttendanceRecord>();
    attendance.filter((record) => record.attendance_date === date).forEach((record) => map.set(record.student_id, record));
    return map;
  }, [attendance, date]);

  const shiftDate = (days: number) => {
    const next = new Date(`${date}T00:00:00`);
    next.setDate(next.getDate() + days);
    setDate(next.toISOString().slice(0, 10));
  };

  const markSingle = async (studentId: string, mark: AttendanceMark) => {
    setUndoStack((prev) => [...prev, attendance]);
    await upsertAttendance(studentId, date, mark);
  };

  const markBulk = async (mark: AttendanceMark) => {
    setBusy(true);
    const before = await bulkAttendance(date, mark);
    setUndoStack((prev) => [...prev, before]);
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
      <SectionHeader title="Attendance" detail={`${recordsByStudent.size}/${students.length} marked`} />
      <Card style={styles.toolbar}>
        <View style={styles.dateRow}>
          <Pressable onPress={() => shiftDate(-1)} style={styles.smallButton}><Text style={styles.buttonText}>Previous</Text></Pressable>
          <Text style={styles.dateText}>{date}</Text>
          <Pressable onPress={() => shiftDate(1)} style={styles.smallButton}><Text style={styles.buttonText}>Next</Text></Pressable>
        </View>
        <View style={styles.bulkRow}>
          <Pressable disabled={busy} onPress={() => markBulk("P")} style={styles.primaryButton}><Text style={styles.primaryText}>Mark all present</Text></Pressable>
          <Pressable disabled={busy} onPress={() => markBulk("H")} style={styles.holidayButton}><Text style={styles.holidayText}>Holiday all</Text></Pressable>
          <Pressable disabled={!undoStack.length} onPress={undo} style={[styles.undoButton, !undoStack.length && styles.disabled]}><Text style={styles.undoText}>Undo</Text></Pressable>
        </View>
      </Card>
      {students.length ? (
        <View style={styles.list}>
          {students.map((student) => {
            const selected = recordsByStudent.get(student.student_id)?.mark ?? "";
            return (
              <Card key={student.student_id} style={styles.row}>
                <View style={styles.student}>
                  <Text style={styles.name}>{student.student_name}</Text>
                  <Text style={styles.meta}>{student.admission_number ?? student.student_id}</Text>
                </View>
                <View style={styles.marks}>
                  {marks.map((item) => (
                    <Chip key={item.mark} label={item.label} selected={selected === item.mark} onPress={() => markSingle(student.student_id, item.mark)} />
                  ))}
                </View>
              </Card>
            );
          })}
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
  dateRow: { alignItems: "center", flexDirection: "row", gap: spacing.md, justifyContent: "space-between" },
  dateText: { color: colors.text, fontSize: 18, fontWeight: "600" },
  smallButton: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    minHeight: 42,
    justifyContent: "center",
    minWidth: 86,
    paddingHorizontal: spacing.md,
  },
  buttonText: { color: colors.text, fontWeight: "500" },
  bulkRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  primaryButton: { backgroundColor: colors.primary, borderRadius: radius.sm, minHeight: 44, justifyContent: "center", paddingHorizontal: spacing.md },
  primaryText: { color: "#FFFFFF", fontWeight: "600" },
  holidayButton: { backgroundColor: "#FFF7ED", borderColor: "#FDBA74", borderRadius: radius.sm, borderWidth: 1, minHeight: 44, justifyContent: "center", paddingHorizontal: spacing.md },
  holidayText: { color: "#9A3412", fontWeight: "600" },
  undoButton: { backgroundColor: colors.cardAlt, borderRadius: radius.sm, minHeight: 44, justifyContent: "center", paddingHorizontal: spacing.md },
  undoText: { color: colors.text, fontWeight: "500" },
  disabled: { opacity: 0.45 },
  list: { gap: spacing.sm },
  row: { alignItems: "center", flexDirection: "row", gap: spacing.md },
  student: { flex: 1, minWidth: 150 },
  name: { color: colors.text, fontSize: 15, fontWeight: "600" },
  meta: { color: colors.muted, fontSize: 12, fontWeight: "400" },
  marks: { flexDirection: "row", gap: spacing.sm },
});
