import { Ionicons } from "@expo/vector-icons";
import { createContext, PropsWithChildren, useCallback, useContext, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radius, shadow, spacing } from "../constants/theme";

type ToastType = "success" | "error" | "info";

type NotificationContextValue = {
  notify: (message: string, type?: ToastType) => void;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: PropsWithChildren) {
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const notify = useCallback((message: string, type: ToastType = "info") => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast({ message, type });
    timerRef.current = setTimeout(() => setToast(null), 2600);
  }, []);

  const value = useMemo(() => ({ notify }), [notify]);
  const icon = toast?.type === "success" ? "checkmark-circle-outline" : toast?.type === "error" ? "alert-circle-outline" : "information-circle-outline";
  const accent = toast?.type === "success" ? colors.success : toast?.type === "error" ? colors.danger : colors.primary;

  return (
    <NotificationContext.Provider value={value}>
      {children}
      {toast ? (
        <Pressable onPress={() => setToast(null)} style={styles.host}>
          <View style={styles.toast}>
            <Ionicons name={icon} size={19} color={accent} />
            <Text style={styles.toastText}>{toast.message}</Text>
          </View>
        </Pressable>
      ) : null}
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotification must be used inside NotificationProvider");
  return ctx;
}

const styles = StyleSheet.create({
  host: {
    bottom: 86,
    left: spacing.lg,
    position: "absolute",
    right: spacing.lg,
    zIndex: 1000,
  },
  toast: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    maxWidth: 520,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...shadow,
  },
  toastText: {
    color: colors.text,
    flexShrink: 1,
    fontSize: 14,
    fontWeight: "500",
  },
});
