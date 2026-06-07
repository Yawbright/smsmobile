import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { router } from "expo-router";
import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";

import { useSupabase } from "./SupabaseProvider";
import { makeDataCacheKey } from "../lib/cacheKeys";
import { demoUser } from "../lib/demoData";
import { MobileUser } from "../types";

type AuthContextValue = {
  user: MobileUser | null;
  isDemoMode: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<{ ok: boolean; message?: string }>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const SESSION_KEY = "oterkpolu.mobile.user";
const DEMO_ADMIN_USERNAME = "admin";
const DEMO_ADMIN_PASSWORD = "admin123";

async function getStoredUser() {
  const raw =
    Platform.OS === "web"
      ? await AsyncStorage.getItem(SESSION_KEY)
      : await SecureStore.getItemAsync(SESSION_KEY);
  return raw ? (JSON.parse(raw) as MobileUser) : null;
}

async function setStoredUser(user: MobileUser | null) {
  if (Platform.OS === "web") {
    if (user) await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(user));
    else await AsyncStorage.removeItem(SESSION_KEY);
    return;
  }
  if (user) await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(user));
  else await SecureStore.deleteItemAsync(SESSION_KEY);
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<MobileUser | null>(null);
  const [isLoading, setLoading] = useState(true);
  const { client, config, hasSupabaseConfig } = useSupabase();
  const isDemoMode = !hasSupabaseConfig;

  useEffect(() => {
    getStoredUser()
      .then(setUser)
      .finally(() => setLoading(false));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isDemoMode,
      isLoading,
      async login(username, password) {
        const trimmed = username.trim().toLowerCase();
        if (!trimmed || !password) {
          return { ok: false, message: "Enter username and password." };
        }

        if (!hasSupabaseConfig && trimmed === DEMO_ADMIN_USERNAME && password === DEMO_ADMIN_PASSWORD) {
          setUser(demoUser);
          await setStoredUser(demoUser);
          router.replace("/(app)/home");
          return { ok: true };
        }

        if (!client) return { ok: false, message: "Set up your school before signing in." };

        const { data, error } = await client.rpc("mobile_login", {
          p_username: trimmed,
          p_password: password,
          p_school_id: config.schoolId,
        });
        if (error || !data) {
          return { ok: false, message: error?.message ?? "Login failed." };
        }
        const nextUser = data as MobileUser;
        await AsyncStorage.removeItem(makeDataCacheKey(config.schoolId));
        setUser(nextUser);
        await setStoredUser(nextUser);
        router.replace("/(app)/home");
        return { ok: true };
      },
      async logout() {
        setUser(null);
        await setStoredUser(null);
        router.replace("/login");
      },
    }),
    [client, config.schoolId, hasSupabaseConfig, isDemoMode, isLoading, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
