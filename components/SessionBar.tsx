import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Pressable, Text } from "react-native";
import { StyleSheet, View } from "react-native";

import { CURRENT_YEAR, GRADES, SECTIONS, TERMS } from "../constants/school";
import { colors, spacing } from "../constants/theme";
import { useData } from "../providers/DataProvider";
import { SelectMenu } from "./SelectMenu";

const years = [CURRENT_YEAR, "2024/2025", "2026/2027"];
const COLLAPSE_KEY = "oterkpolu.mobile.filtersCollapsed";

export function SessionBar() {
  const { session, setSession } = useData();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(COLLAPSE_KEY).then((value) => setCollapsed(value === "1"));
  }, []);

  const toggleCollapsed = async (next: boolean) => {
    setCollapsed(next);
    await AsyncStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
  };

  const setAndRefresh = (next: Partial<typeof session>) => {
    setSession(next);
  };

  if (collapsed) {
    return (
      <View style={styles.collapsedWrap}>
        <View style={styles.context}>
          <Ionicons name="filter-outline" size={16} color={colors.muted} />
          <Text numberOfLines={1} style={styles.contextText}>
            {session.grade} {session.section} - {session.term} - {session.academic_year}
          </Text>
        </View>
        <Pressable onPress={() => toggleCollapsed(false)} style={styles.changeButton}>
          <Text style={styles.changeText}>Change</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <SelectMenu
        compact
        inlineLabel
        label="Class"
        value={session.grade}
        options={GRADES.map((grade) => ({ label: grade, value: grade }))}
        onChange={(grade) => setAndRefresh({ grade })}
      />
      <SelectMenu
        compact
        inlineLabel
        label="Stream"
        value={session.section}
        options={SECTIONS.map((section) => ({ label: section, value: section }))}
        onChange={(section) => setAndRefresh({ section })}
      />
      <SelectMenu
        compact
        inlineLabel
        label="Term"
        value={session.term}
        options={TERMS.map((term) => ({ label: term, value: term }))}
        onChange={(term) => setAndRefresh({ term })}
      />
      <SelectMenu
        compact
        inlineLabel
        label="Year"
        value={session.academic_year}
        options={years.map((year) => ({ label: year, value: year }))}
        onChange={(academic_year) => setAndRefresh({ academic_year })}
      />
      <Pressable onPress={() => toggleCollapsed(true)} style={styles.hideButton}>
        <Ionicons name="chevron-up" size={16} color={colors.muted} />
        <Text style={styles.hideText}>Hide</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.panel,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
  },
  collapsedWrap: {
    alignItems: "center",
    backgroundColor: colors.panel,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    minHeight: 38,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
  },
  context: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: spacing.xs,
  },
  contextText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "500",
  },
  changeButton: {
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 28,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  changeText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "600",
  },
  hideButton: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 2,
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  hideText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "500",
  },
});
