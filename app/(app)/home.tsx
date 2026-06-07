import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { DimensionValue, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { Card, SectionHeader } from "../../components/ui";
import { colors, radius, spacing } from "../../constants/theme";
import { todayISO } from "../../lib/ids";
import { useAuth } from "../../providers/AuthProvider";
import { useData } from "../../providers/DataProvider";
import { useNotification } from "../../providers/NotificationProvider";
import { useSupabase } from "../../providers/SupabaseProvider";

export default function HomeScreen() {
  const { width } = useWindowDimensions();
  const { user, logout } = useAuth();
  const { students, attendance, session, isOnline } = useData();
  const { config } = useSupabase();
  const { notify } = useNotification();
  const today = todayISO();
  const todayMarks = attendance.filter((item) => item.attendance_date === today);
  const present = todayMarks.filter((item) => item.mark === "P").length;
  const marked = todayMarks.length;
  const statWidth = width >= 900 ? "23.5%" : "47%";

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <SectionHeader title="Today" detail={`${session.grade} ${session.section} - ${session.term}`} />
      <View style={styles.grid}>
        <Stat width={statWidth} title="Students" value={String(students.length)} icon="people-outline" />
        <Stat width={statWidth} title="Marked today" value={`${marked}/${students.length}`} icon="calendar-outline" />
        <Stat width={statWidth} title="Present" value={String(present)} icon="checkmark-done-outline" />
        <Stat width={statWidth} title="Sync" value={isOnline ? "Live" : "Needed"} icon="cloud-outline" />
      </View>
      <Card>
        <Text style={styles.cardTitle}>Quick actions</Text>
        <View style={styles.actions}>
          <Action label="Take attendance" icon="calendar-outline" onPress={() => router.push("/(app)/attendance")} />
          <Action label="Enter scores" icon="create-outline" onPress={() => router.push("/(app)/scores")} />
          <Action label="Preview reports" icon="document-text-outline" onPress={() => router.push("/(app)/reports")} />
        </View>
      </Card>
      <Card style={styles.context}>
        <Text style={styles.cardTitle}>Current context</Text>
        <Text style={styles.line}>Academic year: {session.academic_year}</Text>
        <Text style={styles.line}>Class: {session.grade} {session.section}</Text>
        <Text style={styles.line}>Role: {user?.role.replace("_", " ")}</Text>
        <View style={styles.teacherCodeBox}>
          <View style={styles.teacherCodeText}>
            <Text style={styles.teacherCodeLabel}>Teacher access code</Text>
            <Text selectable style={styles.teacherCodeValue}>{config.schoolCode || "Not registered"}</Text>
          </View>
          {config.schoolCode ? (
            <Pressable
              onPress={async () => {
                await Clipboard.setStringAsync(config.schoolCode || "");
                notify("Teacher access code copied.", "success");
              }}
              style={styles.copyButton}
            >
              <Ionicons name="copy-outline" size={17} color={colors.primary} />
              <Text style={styles.copyText}>Copy</Text>
            </Pressable>
          ) : null}
        </View>
        <Pressable onPress={logout} style={styles.logoutButton}>
          <Ionicons name="log-out-outline" size={18} color={colors.danger} />
          <Text style={styles.logoutText}>Logout</Text>
        </Pressable>
      </Card>
    </ScrollView>
  );
}

function Stat({ title, value, icon, width }: { title: string; value: string; icon: keyof typeof Ionicons.glyphMap; width: DimensionValue }) {
  return (
    <Card style={[styles.stat, { width }]}>
      <Ionicons name={icon} size={22} color={colors.primary} />
      <View>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statTitle}>{title}</Text>
      </View>
    </Card>
  );
}

function Action({ label, icon, onPress }: { label: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
      <Ionicons name={icon} size={20} color={colors.primary} />
      <Text style={styles.actionText}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg, padding: spacing.lg, paddingBottom: 96 },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  stat: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    minHeight: 82,
    minWidth: 140,
  },
  statValue: { color: colors.text, fontSize: 24, fontWeight: "600" },
  statTitle: { color: colors.muted, fontSize: 13, fontWeight: "500" },
  cardTitle: { color: colors.text, fontSize: 18, fontWeight: "600", marginBottom: spacing.md },
  actions: { gap: spacing.sm },
  action: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    minHeight: 52,
    paddingHorizontal: spacing.md,
  },
  actionText: { color: colors.text, flex: 1, fontSize: 15, fontWeight: "500" },
  pressed: { opacity: 0.75 },
  context: { gap: spacing.xs },
  line: { color: colors.text, fontSize: 14, fontWeight: "400" },
  teacherCodeBox: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
    marginTop: spacing.md,
    minHeight: 58,
    padding: spacing.md,
  },
  teacherCodeText: { flex: 1, gap: 2 },
  teacherCodeLabel: { color: colors.muted, fontSize: 12, fontWeight: "600", textTransform: "uppercase" },
  teacherCodeValue: { color: colors.text, fontSize: 17, fontWeight: "700" },
  copyButton: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.xs,
    minHeight: 36,
    paddingHorizontal: spacing.md,
  },
  copyText: { color: colors.primary, fontWeight: "600" },
  logoutButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    borderColor: "#FECACA",
    borderRadius: radius.sm,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
    minHeight: 40,
    paddingHorizontal: spacing.md,
  },
  logoutText: { color: colors.danger, fontWeight: "600" },
});
