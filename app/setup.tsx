import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { SUPABASE_SETUP_SQL } from "../constants/supabaseSetupSql";
import { colors, radius, shadow, spacing } from "../constants/theme";
import { useNotification } from "../providers/NotificationProvider";
import { useSupabase } from "../providers/SupabaseProvider";

export default function SetupScreen() {
  const { config, saveConfig, clearConfig, testConfig, directoryReady, setupWithSchoolCode } = useSupabase();
  const { notify } = useNotification();
  const [schoolCode, setSchoolCode] = useState("");
  const [supabaseUrl, setSupabaseUrl] = useState(config.supabaseUrl);
  const [supabaseAnonKey, setSupabaseAnonKey] = useState(config.supabaseAnonKey);
  const [schoolId, setSchoolId] = useState(config.schoolId);
  const [schoolName, setSchoolName] = useState(config.schoolName ?? "");
  const [manualSchoolCode, setManualSchoolCode] = useState(config.schoolCode ?? "");
  const [message, setMessage] = useState("");
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sqlOpen, setSqlOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);

  const current = { supabaseUrl, supabaseAnonKey, schoolId, schoolName, schoolCode: manualSchoolCode };

  useEffect(() => {
    setSupabaseUrl(config.supabaseUrl);
    setSupabaseAnonKey(config.supabaseAnonKey);
    setSchoolId(config.schoolId);
    setSchoolName(config.schoolName ?? "");
    setManualSchoolCode(config.schoolCode ?? "");
  }, [config]);

  const useSchoolCode = async () => {
    setBusy(true);
    const result = await setupWithSchoolCode(schoolCode);
    setOk(result.ok);
    setMessage(result.message);
    notify(result.message, result.ok ? "success" : "error");
    setBusy(false);
    if (result.ok) router.replace("/login");
  };

  const test = async () => {
    setBusy(true);
    const result = await testConfig(current);
    setOk(result.ok);
    setMessage(result.message);
    notify(result.message, result.ok ? "success" : "error");
    setBusy(false);
  };

  const save = async () => {
    setBusy(true);
    await saveConfig(current);
    setOk(true);
    setMessage("Saved. You can sign in with Supabase now.");
    notify("Supabase setup saved.", "success");
    setBusy(false);
    router.replace("/login");
  };

  const reset = async () => {
    await clearConfig();
    setSupabaseUrl("");
    setSupabaseAnonKey("");
    setSchoolId("default-school");
    setManualSchoolCode("");
    setMessage("Saved setup cleared.");
    setOk(false);
    notify("Saved Supabase setup cleared.", "info");
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
        <View style={styles.panel}>
          <Pressable onPress={() => router.back()} style={styles.back}>
            <Ionicons name="chevron-back" size={19} color={colors.text} />
            <Text style={styles.backText}>Back</Text>
          </Pressable>
          <View style={styles.titleRow}>
            <Text style={styles.title}>Supabase Setup</Text>
            <Pressable onPress={() => setSqlOpen(true)} style={styles.infoButton}>
              <Ionicons name="information" size={18} color={colors.primary} />
            </Pressable>
          </View>
          <Text style={styles.sub}>Run the SQL in Supabase first, then enter these connection values here.</Text>
          <View style={styles.codeBox}>
            <Text style={styles.codeTitle}>Teacher setup</Text>
            <Text style={styles.codeSub}>Use the school code from the admin. Once saved on this device, teachers only log in normally.</Text>
            <View style={styles.codeRow}>
              <TextInput
                autoCapitalize="characters"
                value={schoolCode}
                onChangeText={setSchoolCode}
                placeholder="OTERK-7F3K"
                placeholderTextColor={colors.placeholder}
                style={[styles.input, styles.codeInput]}
              />
              <Pressable disabled={busy || !directoryReady} onPress={useSchoolCode} style={[styles.secondaryButton, styles.codeButton, (busy || !directoryReady) && styles.disabled]}>
                <Text style={styles.secondaryText}>Use code</Text>
              </Pressable>
            </View>
            {!directoryReady ? <Text style={styles.helpText}>School-code directory is not configured in this app build yet.</Text> : null}
          </View>
          {message ? <Text style={[styles.message, ok ? styles.success : styles.error]}>{message}</Text> : null}

          <View style={styles.adminPanel}>
            <Pressable onPress={() => setAdminOpen((open) => !open)} style={styles.adminHeader}>
              <View>
                <Text style={styles.manualTitle}>Manual admin setup</Text>
                <Text style={styles.adminSub}>For first-time setup or direct Supabase credentials.</Text>
              </View>
              <Ionicons name={adminOpen ? "chevron-up" : "chevron-down"} size={20} color={colors.muted} />
            </Pressable>
            {adminOpen ? (
              <View style={styles.adminBody}>
                <Field label="School name" value={schoolName} onChangeText={setSchoolName} placeholder="Oterkpolu School" />
                <Field label="School code" value={manualSchoolCode} onChangeText={setManualSchoolCode} placeholder="OTERK-7F3K" />
                <Field label="Supabase URL" value={supabaseUrl} onChangeText={setSupabaseUrl} placeholder="https://your-project.supabase.co" />
                <Field label="Anon key" value={supabaseAnonKey} onChangeText={setSupabaseAnonKey} placeholder="public anon key" multiline />
                <Field label="School ID" value={schoolId} onChangeText={setSchoolId} placeholder="default-school" />
                <View style={styles.actions}>
                  <Pressable disabled={busy} onPress={test} style={[styles.secondaryButton, busy && styles.disabled]}>
                    {busy ? <ActivityIndicator color={colors.primary} /> : <Text style={styles.secondaryText}>Test</Text>}
                  </Pressable>
                  <Pressable disabled={busy} onPress={save} style={[styles.primaryButton, busy && styles.disabled]}>
                    <Text style={styles.primaryText}>Save setup</Text>
                  </Pressable>
                </View>
                <Pressable onPress={reset} style={styles.clearButton}>
                  <Text style={styles.clearText}>Clear saved setup</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        </View>
      </ScrollView>
      <Modal transparent visible={sqlOpen} animationType="fade" onRequestClose={() => setSqlOpen(false)}>
        <Pressable style={styles.sqlBackdrop} onPress={() => setSqlOpen(false)}>
          <Pressable style={styles.sqlPanel} onPress={() => undefined}>
            <View style={styles.sqlHeader}>
              <View>
                <Text style={styles.sqlTitle}>Supabase SQL</Text>
                <Text style={styles.sqlSub}>Copy this into Supabase SQL Editor and run it once.</Text>
              </View>
              <Pressable onPress={() => setSqlOpen(false)} style={styles.iconButton}>
                <Ionicons name="close" size={20} color={colors.text} />
              </Pressable>
            </View>
            <ScrollView style={styles.sqlBox}>
              <Text selectable style={styles.sqlText}>{SUPABASE_SETUP_SQL}</Text>
            </ScrollView>
            <Pressable
              onPress={async () => {
                await Clipboard.setStringAsync(SUPABASE_SETUP_SQL);
                setOk(true);
                setMessage("SQL copied. Paste it in Supabase SQL Editor.");
                setSqlOpen(false);
                setTimeout(() => notify("SQL copied. Paste it in Supabase SQL Editor.", "success"), 180);
              }}
              style={styles.copyButton}
            >
              <Ionicons name="copy-outline" size={18} color="#FFFFFF" />
              <Text style={styles.copyText}>Copy SQL</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function Field({ label, value, onChangeText, placeholder, multiline }: { label: string; value: string; onChangeText: (value: string) => void; placeholder: string; multiline?: boolean }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        autoCapitalize="none"
        multiline={multiline}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.placeholder}
        style={[styles.input, multiline && styles.multiline]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.bg, flex: 1 },
  wrap: { alignItems: "center", flexGrow: 1, justifyContent: "center", padding: spacing.xl },
  panel: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    maxWidth: 540,
    padding: spacing.xl,
    width: "100%",
    ...shadow,
  },
  back: { alignItems: "center", flexDirection: "row", gap: spacing.xs, marginBottom: spacing.lg },
  backText: { color: colors.text, fontWeight: "500" },
  titleRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", gap: spacing.md },
  title: { color: colors.text, fontSize: 26, fontWeight: "600" },
  infoButton: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  sub: { color: colors.muted, fontSize: 14, marginBottom: spacing.lg, marginTop: spacing.xs },
  codeBox: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    gap: spacing.sm,
    marginBottom: spacing.lg,
    padding: spacing.md,
  },
  codeTitle: { color: colors.text, fontSize: 15, fontWeight: "600" },
  codeSub: { color: colors.muted, fontSize: 13 },
  codeRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  codeInput: { flex: 1, minWidth: 180 },
  codeButton: { flexGrow: 0, minWidth: 110 },
  helpText: { color: colors.warning, fontSize: 12 },
  adminPanel: {
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    overflow: "hidden",
  },
  adminHeader: {
    alignItems: "center",
    backgroundColor: colors.card,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 52,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  adminBody: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    padding: spacing.md,
  },
  manualTitle: { color: colors.text, fontSize: 15, fontWeight: "600" },
  adminSub: { color: colors.muted, fontSize: 12, marginTop: 2 },
  field: { marginBottom: spacing.md },
  label: { color: colors.muted, fontSize: 12, fontWeight: "600", marginBottom: spacing.xs, textTransform: "uppercase" },
  input: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    color: colors.text,
    fontSize: 15,
    minHeight: 46,
    paddingHorizontal: spacing.md,
  },
  multiline: { minHeight: 84, paddingTop: spacing.md, textAlignVertical: "top" },
  message: { borderRadius: radius.sm, fontSize: 13, marginBottom: spacing.md, padding: spacing.md },
  success: { backgroundColor: "#ECFDF3", color: colors.success },
  error: { backgroundColor: "#FEF2F2", color: colors.danger },
  actions: { flexDirection: "row", gap: spacing.sm },
  primaryButton: { backgroundColor: colors.primary, borderRadius: radius.sm, flex: 1, minHeight: 46, justifyContent: "center", alignItems: "center" },
  primaryText: { color: "#FFFFFF", fontWeight: "600" },
  secondaryButton: { borderColor: colors.border, borderRadius: radius.sm, borderWidth: 1, flex: 1, minHeight: 46, justifyContent: "center", alignItems: "center" },
  secondaryText: { color: colors.primary, fontWeight: "600" },
  clearButton: { alignSelf: "flex-start", marginTop: spacing.lg },
  clearText: { color: colors.danger, fontWeight: "500" },
  disabled: { opacity: 0.6 },
  sqlBackdrop: {
    alignItems: "center",
    backgroundColor: "rgba(15, 23, 42, 0.36)",
    flex: 1,
    justifyContent: "center",
    padding: spacing.lg,
  },
  sqlPanel: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    maxHeight: "86%",
    maxWidth: 760,
    padding: spacing.lg,
    width: "100%",
    ...shadow,
  },
  sqlHeader: { alignItems: "flex-start", flexDirection: "row", gap: spacing.md, justifyContent: "space-between" },
  sqlTitle: { color: colors.text, fontSize: 19, fontWeight: "600" },
  sqlSub: { color: colors.muted, fontSize: 13, marginTop: 2 },
  iconButton: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  sqlBox: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.sm,
    marginVertical: spacing.md,
    maxHeight: 380,
    padding: spacing.md,
  },
  sqlText: { color: colors.text, fontFamily: "monospace", fontSize: 12, lineHeight: 18 },
  copyButton: {
    alignItems: "center",
    alignSelf: "flex-end",
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    flexDirection: "row",
    gap: spacing.sm,
    minHeight: 42,
    paddingHorizontal: spacing.lg,
  },
  copyText: { color: "#FFFFFF", fontWeight: "600" },
});
