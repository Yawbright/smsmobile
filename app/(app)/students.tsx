import { useMemo, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { Card, EmptyState, SectionHeader } from "../../components/ui";
import { SelectMenu } from "../../components/SelectMenu";
import { colors, radius, spacing } from "../../constants/theme";
import { useData } from "../../providers/DataProvider";
import { Student, StudentDraft } from "../../types";

const emptyDraft: StudentDraft = {
  student_name: "",
  gender: "",
  admission_number: "",
  parent_name: "",
  parent_contact: "",
  house: "",
  department: "",
};

export default function StudentsScreen() {
  const { students, attendance, saveStudent, deleteStudent, houseOptions, departmentOptions } = useData();
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<StudentDraft>(emptyDraft);
  const [modalOpen, setModalOpen] = useState(false);

  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    return students.filter((student) =>
      [student.student_name, student.admission_number, student.parent_name].some((value) => value?.toLowerCase().includes(text)),
    );
  }, [query, students]);

  const selected = draft.student_id ? students.find((student) => student.student_id === draft.student_id) : null;
  const present = selected ? attendance.filter((item) => item.student_id === selected.student_id && item.mark === "P").length : 0;

  const openAdd = () => {
    setDraft(emptyDraft);
    setModalOpen(true);
  };

  const openEdit = (student: Student) => {
    setDraft(studentToDraft(student));
    setModalOpen(true);
  };

  const save = async () => {
    if (!draft.student_name.trim()) return;
    await saveStudent(draft);
    setQuery("");
    setModalOpen(false);
    setDraft(emptyDraft);
  };

  const remove = async () => {
    if (!draft.student_id) return;
    const run = async () => {
      await deleteStudent(draft.student_id!);
      setModalOpen(false);
      setDraft(emptyDraft);
    };
    Alert.alert("Delete student", `Remove ${draft.student_name}?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: run },
    ]);
  };

  return (
    <>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <SectionHeader title="Students" detail={`${filtered.length} active`} />
          <Pressable onPress={openAdd} style={styles.addButton}><Text style={styles.addText}>Add</Text></Pressable>
        </View>
        <TextInput value={query} onChangeText={setQuery} placeholder="Search by name, admission no. or parent" placeholderTextColor={colors.placeholder} style={styles.search} />
        <View style={styles.list}>
          {filtered.length ? filtered.map((student) => (
            <Pressable key={student.student_id} onPress={() => openEdit(student)} style={styles.row}>
              <Text numberOfLines={1} style={styles.rowName}>{student.student_name}</Text>
              <Text numberOfLines={1} style={styles.rowMeta}>{student.admission_number ?? student.student_id}</Text>
            </Pressable>
          )) : <EmptyState title="No students found" body="Change the search text or class selector." />}
        </View>
      </ScrollView>
      <Modal transparent visible={modalOpen} animationType="fade" onRequestClose={() => setModalOpen(false)}>
        <View style={styles.backdrop}>
          <Card style={styles.modal}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.editorTitle}>{draft.student_id ? "Edit student" : "Add student"}</Text>
                <Text style={styles.editorMeta}>{draft.student_id ? `Student ID: ${draft.student_id}` : "A new student_id will be created on save."}</Text>
              </View>
              <Pressable onPress={() => setModalOpen(false)} style={styles.closeButton}><Text style={styles.closeText}>Close</Text></Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
              <Field label="Full name" value={draft.student_name} onChangeText={(student_name) => setDraft((prev) => ({ ...prev, student_name }))} />
              <View style={styles.twoCols}>
                <Field label="Gender" value={draft.gender} onChangeText={(gender) => setDraft((prev) => ({ ...prev, gender }))} />
                <Field label="Admission no." value={draft.admission_number ?? ""} onChangeText={(admission_number) => setDraft((prev) => ({ ...prev, admission_number }))} />
              </View>
              <Field label="Parent" value={draft.parent_name ?? ""} onChangeText={(parent_name) => setDraft((prev) => ({ ...prev, parent_name }))} />
              <View style={styles.twoCols}>
                <Field label="Contact" value={draft.parent_contact ?? ""} onChangeText={(parent_contact) => setDraft((prev) => ({ ...prev, parent_contact }))} />
                <OptionField
                  label="House"
                  value={draft.house ?? ""}
                  options={houseOptions}
                  onChange={(house) => setDraft((prev) => ({ ...prev, house }))}
                />
              </View>
              <OptionField
                label="Department"
                value={draft.department ?? ""}
                options={departmentOptions}
                onChange={(department) => setDraft((prev) => ({ ...prev, department }))}
              />
              {selected ? <Text style={styles.detail}>Present marks loaded: {present}</Text> : null}
            </ScrollView>
            <View style={styles.actions}>
              <Pressable disabled={!draft.student_name.trim()} onPress={save} style={[styles.saveButton, !draft.student_name.trim() && styles.disabled]}>
                <Text style={styles.saveText}>Save</Text>
              </Pressable>
              {draft.student_id ? (
                <Pressable onPress={remove} style={styles.deleteButton}><Text style={styles.deleteText}>Delete</Text></Pressable>
              ) : null}
            </View>
          </Card>
        </View>
      </Modal>
    </>
  );
}

function studentToDraft(student: Student): StudentDraft {
  return {
    student_id: student.student_id,
    student_name: student.student_name,
    gender: student.gender,
    admission_number: student.admission_number ?? "",
    parent_name: student.parent_name ?? "",
    parent_contact: student.parent_contact ?? "",
    house: student.house ?? "",
    department: student.department ?? "",
  };
}

function Field({ label, value, onChangeText }: { label: string; value: string; onChangeText: (value: string) => void }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput value={value} onChangeText={onChangeText} placeholderTextColor={colors.placeholder} style={styles.input} />
    </View>
  );
}

function OptionField({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  const cleaned = options.map((item) => item.trim()).filter(Boolean);
  if (!cleaned.length) return <Field label={label} value={value} onChangeText={onChange} />;
  const merged = value && !cleaned.includes(value) ? [value, ...cleaned] : cleaned;
  return (
    <View style={styles.selectField}>
      <SelectMenu
        label={label}
        value={value}
        options={merged.map((item) => ({ label: item, value: item }))}
        onChange={onChange}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg, padding: spacing.lg, paddingBottom: 96 },
  headerRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  addButton: { backgroundColor: colors.primary, borderRadius: radius.sm, minHeight: 40, justifyContent: "center", paddingHorizontal: spacing.lg },
  addText: { color: "#FFFFFF", fontSize: 14, fontWeight: "600" },
  search: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    color: colors.text,
    fontSize: 15,
    minHeight: 48,
    paddingHorizontal: spacing.md,
  },
  list: { gap: spacing.sm },
  row: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    minHeight: 52,
    paddingHorizontal: spacing.md,
  },
  rowName: { color: colors.text, flex: 1, fontSize: 15, fontWeight: "600" },
  rowMeta: { color: colors.muted, fontSize: 13, fontWeight: "400", maxWidth: 160, textAlign: "right" },
  backdrop: {
    alignItems: "center",
    backgroundColor: "rgba(15, 23, 42, 0.32)",
    flex: 1,
    justifyContent: "center",
    padding: spacing.lg,
  },
  modal: {
    maxHeight: "88%",
    maxWidth: 560,
    width: "100%",
  },
  modalHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
  },
  editorTitle: { color: colors.text, fontSize: 19, fontWeight: "600" },
  editorMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  closeButton: {
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  closeText: { color: colors.text, fontWeight: "500" },
  modalBody: { gap: spacing.md, paddingVertical: spacing.lg },
  twoCols: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  field: { flex: 1, minWidth: 150 },
  selectField: { flex: 1, minWidth: 150 },
  label: { color: colors.muted, fontSize: 12, fontWeight: "600", marginBottom: spacing.xs },
  input: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    color: colors.text,
    fontSize: 15,
    minHeight: 44,
    paddingHorizontal: spacing.md,
  },
  detail: { color: colors.muted, fontSize: 13 },
  actions: { flexDirection: "row", gap: spacing.sm },
  saveButton: { backgroundColor: colors.primary, borderRadius: radius.sm, minHeight: 44, justifyContent: "center", paddingHorizontal: spacing.lg },
  saveText: { color: "#FFFFFF", fontWeight: "600" },
  deleteButton: { backgroundColor: "#FEF2F2", borderColor: "#FECACA", borderRadius: radius.sm, borderWidth: 1, minHeight: 44, justifyContent: "center", paddingHorizontal: spacing.lg },
  deleteText: { color: colors.danger, fontWeight: "600" },
  disabled: { opacity: 0.45 },
});
