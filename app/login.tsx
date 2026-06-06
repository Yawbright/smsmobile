import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, radius, shadow, spacing } from "../constants/theme";
import { useAuth } from "../providers/AuthProvider";
import { useNotification } from "../providers/NotificationProvider";
import { useSupabase } from "../providers/SupabaseProvider";

export default function LoginScreen() {
  const { login } = useAuth();
  const { notify } = useNotification();
  const { config, hasSupabaseConfig, directoryReady, setupWithSchoolCode } = useSupabase();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [schoolCode, setSchoolCode] = useState(config.schoolCode ?? "");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [setupBusy, setSetupBusy] = useState(false);

  useEffect(() => {
    setSchoolCode(config.schoolCode ?? "");
  }, [config.schoolCode]);

  const setupSchool = async () => {
    setSetupBusy(true);
    setMessage("");
    const result = await setupWithSchoolCode(schoolCode);
    setMessage(result.message);
    notify(result.message, result.ok ? "success" : "error");
    setSetupBusy(false);
  };

  const submit = async () => {
    setBusy(true);
    setMessage("");
    const result = await login(username, password);
    if (!result.ok) setMessage(result.message ?? "Could not sign in.");
    setBusy(false);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.wrap}>
        <View style={styles.panel}>
          <View style={styles.mark}>
            <Ionicons name="school-outline" size={30} color={colors.primary} />
          </View>
          <Text style={styles.title}>Oterkpolu Mobile</Text>
          <Text style={styles.sub}>{config.schoolName || "Teacher and admin companion"}</Text>
          <View style={styles.schoolBox}>
            <View style={styles.schoolHeader}>
              <Text style={styles.schoolTitle}>{hasSupabaseConfig ? config.schoolCode || "School connected" : "School code"}</Text>
              {hasSupabaseConfig ? <Ionicons name="checkmark-circle" size={17} color={colors.success} /> : null}
            </View>
            <View style={styles.codeRow}>
              <TextInput
                autoCapitalize="characters"
                value={schoolCode}
                onChangeText={setSchoolCode}
                style={[styles.input, styles.codeInput]}
                placeholder="OTERK-7F3K"
                placeholderTextColor={colors.placeholder}
              />
              <Pressable disabled={setupBusy || !directoryReady} onPress={setupSchool} style={[styles.codeButton, (setupBusy || !directoryReady) && styles.disabled]}>
                {setupBusy ? <ActivityIndicator color={colors.primary} /> : <Text style={styles.codeButtonText}>{hasSupabaseConfig ? "Change" : "Use"}</Text>}
              </Pressable>
            </View>
            {!directoryReady ? <Text style={styles.hint}>School-code directory is not configured in this app build.</Text> : null}
          </View>
          {!hasSupabaseConfig ? <Text style={styles.demo}>Enter your school code before signing in, or use the demo admin developer override.</Text> : null}
          <View style={styles.field}>
            <Text style={styles.label}>Username</Text>
            <TextInput autoCapitalize="none" value={username} onChangeText={setUsername} style={styles.input} placeholder="teacher username" />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <TextInput secureTextEntry value={password} onChangeText={setPassword} style={styles.input} placeholder="password" />
          </View>
          {message ? <Text style={styles.error}>{message}</Text> : null}
          <Pressable disabled={busy} onPress={submit} style={({ pressed }) => [styles.button, pressed && styles.pressed, busy && styles.disabled]}>
            {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Sign in</Text>}
          </Pressable>
          <Pressable onPress={() => router.push("/setup")} style={styles.setupButton}>
            <Ionicons name="settings-outline" size={17} color={colors.primary} />
            <Text style={styles.setupText}>Supabase setup</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.bg, flex: 1 },
  wrap: { alignItems: "center", flex: 1, justifyContent: "center", padding: spacing.xl },
  panel: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    maxWidth: 420,
    padding: spacing.xl,
    width: "100%",
    ...shadow,
  },
  mark: {
    alignItems: "center",
    backgroundColor: colors.cardAlt,
    borderRadius: radius.md,
    height: 54,
    justifyContent: "center",
    width: 54,
  },
  title: { color: colors.text, fontSize: 28, fontWeight: "600", marginTop: spacing.lg },
  sub: { color: colors.muted, fontSize: 15, fontWeight: "400", marginBottom: spacing.lg },
  demo: {
    backgroundColor: "#FFFBEB",
    borderColor: "#FDE68A",
    borderRadius: radius.sm,
    borderWidth: 1,
    color: colors.text,
    fontSize: 13,
    fontWeight: "400",
    marginBottom: spacing.lg,
    padding: spacing.md,
  },
  schoolBox: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    gap: spacing.sm,
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  schoolHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  schoolTitle: { color: colors.text, fontSize: 14, fontWeight: "600" },
  codeRow: { flexDirection: "row", gap: spacing.sm },
  codeInput: { flex: 1, minHeight: 44 },
  codeButton: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
    width: 86,
  },
  codeButtonText: { color: colors.primary, fontWeight: "600" },
  hint: { color: colors.warning, fontSize: 12 },
  field: { marginBottom: spacing.md },
  label: { color: colors.muted, fontSize: 12, fontWeight: "600", marginBottom: spacing.xs, textTransform: "uppercase" },
  input: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    color: colors.text,
    fontSize: 16,
    minHeight: 48,
    paddingHorizontal: spacing.md,
  },
  error: { color: colors.danger, fontSize: 13, fontWeight: "500", marginBottom: spacing.md },
  button: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    minHeight: 50,
    justifyContent: "center",
  },
  buttonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "600" },
  setupButton: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs,
    justifyContent: "center",
    minHeight: 44,
    marginTop: spacing.md,
  },
  setupText: { color: colors.primary, fontWeight: "600" },
  pressed: { opacity: 0.82 },
  disabled: { opacity: 0.65 },
});
