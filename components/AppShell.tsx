import { Ionicons } from "@expo/vector-icons";
import { router, usePathname } from "expo-router";
import { ReactNode } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, spacing } from "../constants/theme";
import { roleLabel } from "../lib/permissions";
import { useAuth } from "../providers/AuthProvider";
import { useData } from "../providers/DataProvider";
import { SessionBar } from "./SessionBar";

const navItems = [
  { label: "Home", icon: "home-outline", href: "/(app)/home" },
  { label: "Students", icon: "people-outline", href: "/(app)/students" },
  { label: "Attendance", icon: "calendar-outline", href: "/(app)/attendance" },
  { label: "Scores", icon: "create-outline", href: "/(app)/scores" },
  { label: "Reports", icon: "document-text-outline", href: "/(app)/reports" },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { width } = useWindowDimensions();
  const wide = width >= 768;
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { isOnline, isSyncing, lastSyncedAt } = useData();

  const statusText = isSyncing ? "Syncing" : isOnline ? "Online" : "Supabase needed";

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.root}>
        {wide ? (
          <View style={styles.sidebar}>
            <Text style={styles.brand}>Oterkpolu</Text>
            <Text style={styles.brandSub}>Mobile companion</Text>
            <View style={styles.nav}>
              {navItems.map((item) => {
                const selected = pathname.includes(item.href.replace("/(app)", ""));
                return (
                  <Pressable key={item.href} onPress={() => router.push(item.href)} style={[styles.sideItem, selected && styles.sideSelected]}>
                    <Ionicons name={item.icon} size={20} color={selected ? "#FFFFFF" : colors.sidebarText} />
                    <Text style={styles.sideText}>{item.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.sidebarFooter}>
              <Text style={styles.sideRole}>{roleLabel(user?.role ?? "class_teacher")}</Text>
              <Text style={styles.sideName}>{user?.full_name}</Text>
              <Pressable onPress={logout} style={styles.logout}>
                <Ionicons name="log-out-outline" size={18} color={colors.sidebarText} />
                <Text style={styles.logoutText}>Sign out</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
        <View style={styles.content}>
          <View style={styles.topbar}>
            <View>
              <Text style={styles.userName}>{user?.full_name}</Text>
              <Text style={styles.userMeta}>{roleLabel(user?.role ?? "class_teacher")}</Text>
            </View>
            <Pressable onPress={() => router.push("/setup")} style={[styles.syncPill, !isOnline && styles.syncOffline]}>
              <Ionicons name={isOnline ? "cloud-done-outline" : "cloud-offline-outline"} size={16} color={isOnline ? colors.success : colors.warning} />
              <Text style={styles.syncText}>{statusText}</Text>
            </Pressable>
          </View>
          <SessionBar />
          <View style={styles.body}>{children}</View>
          {lastSyncedAt ? <Text style={styles.lastSync}>Last sync {new Date(lastSyncedAt).toLocaleTimeString()}</Text> : null}
          {!wide ? (
            <View style={styles.bottomNav}>
              {navItems.map((item) => {
                const selected = pathname.includes(item.href.replace("/(app)", ""));
                return (
                  <Pressable key={item.href} onPress={() => router.push(item.href)} style={styles.bottomItem}>
                    <Ionicons name={item.icon} size={22} color={selected ? colors.primary : colors.muted} />
                    <Text style={[styles.bottomText, selected && styles.bottomSelected]}>{item.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.bg, flex: 1 },
  root: { flex: 1, flexDirection: "row" },
  sidebar: {
    backgroundColor: colors.sidebar,
    padding: spacing.lg,
    width: 244,
  },
  brand: { color: "#FFFFFF", fontSize: 24, fontWeight: "600" },
  brandSub: { color: "#CBD5E1", fontSize: 13, marginTop: 2 },
  nav: { gap: spacing.sm, marginTop: spacing.xl },
  sideItem: {
    alignItems: "center",
    borderRadius: 8,
    flexDirection: "row",
    gap: spacing.md,
    minHeight: 46,
    paddingHorizontal: spacing.md,
  },
  sideSelected: { backgroundColor: colors.primary },
  sideText: { color: colors.sidebarText, fontSize: 15, fontWeight: "500" },
  sidebarFooter: { gap: spacing.xs, marginTop: "auto" },
  sideRole: { color: "#93C5FD", fontSize: 12, fontWeight: "600", textTransform: "uppercase" },
  sideName: { color: "#FFFFFF", fontSize: 15, fontWeight: "500" },
  logout: { alignItems: "center", flexDirection: "row", gap: spacing.sm, marginTop: spacing.md, minHeight: 40 },
  logoutText: { color: colors.sidebarText, fontWeight: "500" },
  content: { flex: 1 },
  topbar: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  userName: { color: colors.text, fontSize: 17, fontWeight: "600" },
  userMeta: { color: colors.muted, fontSize: 13, fontWeight: "400" },
  syncPill: {
    alignItems: "center",
    backgroundColor: "#ECFDF3",
    borderColor: "#BBF7D0",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  syncOffline: { backgroundColor: "#FFFBEB", borderColor: "#FDE68A" },
  syncText: { color: colors.text, fontSize: 12, fontWeight: "600" },
  body: { flex: 1 },
  lastSync: {
    color: colors.muted,
    fontSize: 11,
    paddingRight: spacing.lg,
    textAlign: "right",
  },
  bottomNav: {
    backgroundColor: colors.card,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: "row",
    justifyContent: "space-around",
    paddingBottom: spacing.sm,
    paddingTop: spacing.sm,
  },
  bottomItem: { alignItems: "center", flex: 1, gap: 2, minHeight: 48 },
  bottomText: { color: colors.muted, fontSize: 11, fontWeight: "500" },
  bottomSelected: { color: colors.primary },
});
