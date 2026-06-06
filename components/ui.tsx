import { ReactNode } from "react";
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";

import { colors, radius, shadow, spacing } from "../constants/theme";

type ChipProps = {
  label: string;
  selected?: boolean;
  disabled?: boolean;
  onPress?: () => void;
};

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Chip({ label, selected, disabled, onPress }: ChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

export function Label({ children }: { children: ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <Card style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
    </Card>
  );
}

export function SectionHeader({ title, detail }: { title: string; detail?: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {detail ? <Text style={styles.sectionDetail}>{detail}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.lg,
    ...shadow,
  },
  chip: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    minHeight: 40,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "500",
  },
  chipTextSelected: {
    color: "#FFFFFF",
  },
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.75,
  },
  label: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600",
    marginBottom: spacing.xs,
    textTransform: "uppercase",
  },
  empty: {
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.xl,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "600",
  },
  emptyBody: {
    color: colors.muted,
    fontSize: 14,
    textAlign: "center",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "600",
  },
  sectionDetail: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "400",
  },
});
