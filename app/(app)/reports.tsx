import { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { SelectMenu } from "../../components/SelectMenu";
import { Card, EmptyState, SectionHeader } from "../../components/ui";
import { colors, radius, spacing } from "../../constants/theme";
import { buildStudentReportPreview } from "../../lib/reportCalculator";
import { useData } from "../../providers/DataProvider";

export default function ReportsScreen() {
  const { students, subjects, scores, attendance, session, scoreComponents, assessmentGroups, gradingScale } = useData();
  const [selectedId, setSelectedId] = useState(students[0]?.student_id ?? "");
  const selected = students.find((student) => student.student_id === selectedId) ?? students[0];

  useEffect(() => {
    if (students.length && !students.some((student) => student.student_id === selectedId)) {
      setSelectedId(students[0].student_id);
    }
  }, [selectedId, students]);

  const report = useMemo(() => {
    if (!selected) return null;
    return buildStudentReportPreview({
      student: selected,
      scores,
      attendance,
      scoreComponents,
      subjects,
      assessmentGroups,
      gradingScale,
    });
  }, [assessmentGroups, attendance, gradingScale, scoreComponents, scores, selected, subjects]);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <SectionHeader title="Report Preview" detail={`${session.academic_year} - ${session.term}`} />
      {students.length && selected && report ? (
        <>
          <SelectMenu
            label="Student"
            value={selected.student_id}
            options={students.map((student) => ({ label: student.student_name, value: student.student_id }))}
            onChange={setSelectedId}
            leftIcon="person-outline"
          />
          <Card style={styles.summary}>
            <Text style={styles.name}>{selected.student_name}</Text>
            <Text style={styles.meta}>
              {selected.admission_number ? `Admission No: ${selected.admission_number}` : `Student ID: ${selected.student_id}`}
            </Text>
            <Text style={styles.meta}>{selected.grade}{selected.stream} - {session.term} - {session.academic_year}</Text>
            <View style={styles.summaryGrid}>
              <Metric label="Total" value={report.subjectsScored ? String(report.total) : "No scores"} />
              <Metric label="Average" value={report.subjectsScored ? String(report.average) : "No scores"} />
              <Metric label="Attendance" value={report.attendanceTotal ? `${report.attendancePresent}/${report.attendanceTotal}` : "No marks"} />
              <Metric label="Subjects" value={`${report.subjectsScored}/${subjects.length}`} />
            </View>
          </Card>
          <Card style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.cell, styles.subject]}>Subject</Text>
              <Text style={styles.cell}>Class Score</Text>
              <Text style={styles.cell}>Exam Score</Text>
              <Text style={styles.cell}>Total</Text>
              <Text style={styles.cell}>Grade</Text>
              <Text style={[styles.cell, styles.remark]}>Remarks</Text>
            </View>
            {report.subjectRows.map((row) => (
              <View key={row.subject} style={styles.tableRow}>
                <Text style={[styles.cell, styles.subject]}>{row.subject}</Text>
                <Text style={styles.cell}>{row.hasScore ? row.classScore : "-"}</Text>
                <Text style={styles.cell}>{row.hasScore ? row.examScore : "-"}</Text>
                <Text style={[styles.cell, styles.total]}>{row.hasScore ? row.total : "-"}</Text>
                <Text style={styles.cell}>{row.grade}</Text>
                <Text style={[styles.cell, styles.remark]}>{row.remark}</Text>
              </View>
            ))}
          </Card>
        </>
      ) : (
        <EmptyState title="No report available" body="Pick a class with active students and synced scores." />
      )}
    </ScrollView>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg, padding: spacing.lg, paddingBottom: 96 },
  summary: { gap: spacing.md },
  name: { color: colors.text, fontSize: 21, fontWeight: "600" },
  meta: { color: colors.muted, fontSize: 12, fontWeight: "400" },
  summaryGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  metric: { backgroundColor: colors.panel, borderRadius: radius.sm, flexGrow: 1, minWidth: 110, padding: spacing.md },
  metricLabel: { color: colors.muted, fontSize: 12, fontWeight: "600", textTransform: "uppercase" },
  metricValue: { color: colors.text, fontSize: 18, fontWeight: "600", marginTop: spacing.xs },
  table: { padding: 0 },
  tableHeader: { backgroundColor: colors.cardAlt, flexDirection: "row", padding: spacing.md },
  tableRow: { borderTopColor: colors.border, borderTopWidth: 1, flexDirection: "row", padding: spacing.md },
  cell: { color: colors.text, flex: 1, fontSize: 12, fontWeight: "500", textAlign: "center" },
  subject: { flex: 2.1, textAlign: "left" },
  remark: { flex: 1.5 },
  total: { color: colors.primary, fontWeight: "600" },
});
