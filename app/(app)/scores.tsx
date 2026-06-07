import { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { SelectMenu, SelectRow } from "../../components/SelectMenu";
import { Card, EmptyState, SectionHeader } from "../../components/ui";
import { colors, radius, spacing } from "../../constants/theme";
import { useData } from "../../providers/DataProvider";
import { ScoreComponent } from "../../types";

export default function ScoresScreen() {
  const { students, subjects, scores, scoreComponents, upsertScore } = useData();
  const [subject, setSubject] = useState(subjects[0] ?? "");
  const [field, setField] = useState(scoreComponents[0]?.field ?? "");
  const component = scoreComponents.find((item) => item.field === field) ?? scoreComponents[0];

  useEffect(() => {
    if (!subjects.includes(subject)) setSubject(subjects[0] ?? "");
  }, [subject, subjects]);

  useEffect(() => {
    if (!scoreComponents.some((item) => item.field === field)) setField(scoreComponents[0]?.field ?? "");
  }, [field, scoreComponents]);

  const byStudent = useMemo(() => {
    const map = new Map<string, number | undefined>();
    scores
      .filter((item) => item.subject === subject)
      .forEach((record) => map.set(record.student_id, component ? readScoreValue(record.scores, component) : undefined));
    return map;
  }, [component, scores, subject]);

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <SectionHeader title="Scores" detail={`${subject} - ${component?.label ?? "Component"} / ${component?.max ?? 0}`} />
      <Card style={styles.selectors}>
        <Text style={styles.selectorTitle}>Entry setup</Text>
        <SelectRow>
          <SelectMenu
            compact
            label="Subject"
            value={subject}
            options={subjects.map((item) => ({ label: item, value: item }))}
            onChange={setSubject}
          />
          <SelectMenu
            compact
            label="Score field"
            value={field}
            options={scoreComponents.map((item) => ({ label: `${item.label} / ${item.max}`, value: item.field }))}
            onChange={setField}
          />
        </SelectRow>
      </Card>
      {students.length ? (
        <View style={styles.list}>
          {students.map((student) => {
            const value = byStudent.get(student.student_id);
            return (
              <Card key={student.student_id} style={styles.row}>
                <View style={styles.student}>
                  <Text style={styles.name}>{student.student_name}</Text>
                  <Text style={styles.meta}>{student.admission_number ?? student.student_id}</Text>
                </View>
                <ScoreInput
                  key={`${student.student_id}-${subject}-${field}`}
                  value={value}
                  max={component?.max ?? 100}
                  onSave={(nextValue) => upsertScore(student.student_id, subject, field, nextValue)}
                />
              </Card>
            );
          })}
        </View>
      ) : (
        <EmptyState title="No students" body="Pick a class with active students before entering scores." />
      )}
    </ScrollView>
  );
}

function readScoreValue(scores: Record<string, number> | undefined, component: ScoreComponent) {
  if (!scores) return undefined;
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

function ScoreInput({ value, max, onSave }: { value: number | undefined; max: number; onSave: (value: number | null) => Promise<void> }) {
  const [text, setText] = useState(value === undefined ? "" : String(value));
  const [error, setError] = useState(false);

  useEffect(() => {
    setText(value === undefined ? "" : String(value));
    setError(false);
  }, [value, max]);

  const commit = async () => {
    const trimmed = text.trim();
    if (!trimmed) {
      setError(false);
      await onSave(null);
      return;
    }
    const parsed = Number(trimmed);
    if (Number.isNaN(parsed) || parsed < 0 || parsed > max) {
      setError(true);
      return;
    }
    setError(false);
    setText(String(parsed));
    await onSave(parsed);
  };

  return (
    <View style={styles.inputWrap}>
      <TextInput
        value={text}
        keyboardType="numeric"
        maxLength={4}
        onBlur={commit}
        onChangeText={(next) => {
          setError(false);
          setText(next.replace(/[^0-9.]/g, ""));
        }}
        placeholder={`1-${max}`}
        placeholderTextColor={colors.placeholder}
        style={[styles.input, error && styles.inputError]}
      />
      {error ? <Text style={styles.errorText}>0-{max}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg, padding: spacing.lg, paddingBottom: 96 },
  selectors: { gap: spacing.md },
  selectorTitle: { color: colors.muted, fontSize: 12, fontWeight: "600", textTransform: "uppercase" },
  list: { gap: spacing.sm },
  row: { alignItems: "center", flexDirection: "row", gap: spacing.md },
  student: { flex: 1 },
  name: { color: colors.text, fontSize: 15, fontWeight: "600" },
  meta: { color: colors.muted, fontSize: 12, fontWeight: "400" },
  inputWrap: {
    alignItems: "center",
    width: 86,
  },
  input: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    color: colors.text,
    fontSize: 17,
    fontWeight: "400",
    minHeight: 46,
    paddingHorizontal: spacing.md,
    textAlign: "center",
    width: "100%",
  },
  inputError: {
    borderColor: colors.danger,
  },
  errorText: {
    color: colors.danger,
    fontSize: 10,
    marginTop: 2,
  },
});
