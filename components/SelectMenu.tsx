import { Ionicons } from "@expo/vector-icons";
import { ReactNode, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radius, spacing } from "../constants/theme";

type Option = {
  label: string;
  value: string;
  icon?: keyof typeof Ionicons.glyphMap;
};

type SelectMenuProps = {
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  compact?: boolean;
  inlineLabel?: boolean;
  leftIcon?: keyof typeof Ionicons.glyphMap;
};

export function SelectMenu({ label, value, options, onChange, compact, inlineLabel, leftIcon }: SelectMenuProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);

  const choose = (next: string) => {
    onChange(next);
    setOpen(false);
  };

  return (
    <>
      <Pressable onPress={() => setOpen(true)} style={({ pressed }) => [styles.control, compact && styles.compact, pressed && styles.pressed]}>
        {leftIcon ? <Ionicons name={leftIcon} size={17} color={colors.muted} /> : null}
        <View style={[styles.textBlock, inlineLabel && styles.inlineTextBlock]}>
          <Text style={styles.label}>{inlineLabel ? `${label}:` : label}</Text>
          <Text numberOfLines={1} style={styles.value}>{selected?.label ?? value}</Text>
        </View>
        <Ionicons name="chevron-down" size={17} color={colors.muted} />
      </Pressable>
      <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.menu}>
            <Text style={styles.menuTitle}>{label}</Text>
            {options.map((option) => (
              <Pressable key={option.value} onPress={() => choose(option.value)} style={styles.option}>
                {option.icon ? <Ionicons name={option.icon} size={19} color={colors.primary} /> : null}
                <Text style={styles.optionText}>{option.label}</Text>
                {option.value === value ? <Ionicons name="checkmark" size={19} color={colors.primary} /> : null}
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

export function SelectRow({ children }: { children: ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

const styles = StyleSheet.create({
  control: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    minHeight: 44,
    minWidth: 150,
    paddingHorizontal: spacing.md,
  },
  compact: {
    flex: 1,
    minHeight: 36,
    minWidth: 140,
    paddingHorizontal: spacing.sm,
  },
  textBlock: {
    flex: 1,
  },
  inlineTextBlock: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs,
  },
  label: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "500",
    textTransform: "uppercase",
  },
  value: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "500",
    marginTop: 1,
  },
  pressed: {
    opacity: 0.72,
  },
  backdrop: {
    alignItems: "center",
    backgroundColor: "rgba(15, 23, 42, 0.26)",
    flex: 1,
    justifyContent: "center",
    padding: spacing.lg,
  },
  menu: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    maxWidth: 420,
    overflow: "hidden",
    width: "100%",
  },
  menuTitle: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    textTransform: "uppercase",
  },
  option: {
    alignItems: "center",
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    minHeight: 50,
    paddingHorizontal: spacing.lg,
  },
  optionText: {
    color: colors.text,
    flex: 1,
    fontSize: 15,
    fontWeight: "400",
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
});
