import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import Constants from "expo-constants";

const extra = Constants.expoConfig?.extra as
  | {
      supabaseUrl?: string;
      supabaseAnonKey?: string;
      schoolId?: string;
      directoryApiUrl?: string;
    }
  | undefined;

export type SupabaseRuntimeConfig = {
  supabaseUrl: string;
  supabaseAnonKey: string;
  schoolId: string;
  schoolName?: string;
  schoolCode?: string;
  approvalStatus?: "pending" | "active" | "suspended" | "rejected";
};

export const SUPABASE_CONFIG_KEY = "oterkpolu.mobile.supabaseConfig";

export const envSupabaseConfig: SupabaseRuntimeConfig = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? extra?.supabaseUrl ?? "",
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? extra?.supabaseAnonKey ?? "",
  schoolId: process.env.EXPO_PUBLIC_SCHOOL_ID ?? extra?.schoolId ?? "default-school",
  schoolName: "",
  schoolCode: "",
  approvalStatus: "active",
};

export const directoryApiUrl =
  process.env.EXPO_PUBLIC_DIRECTORY_API_URL ?? extra?.directoryApiUrl ?? "";

export function hasConfig(config: SupabaseRuntimeConfig | null | undefined) {
  return Boolean(config?.supabaseUrl && config?.supabaseAnonKey && config?.schoolId);
}

export function createSupabaseClient(config: SupabaseRuntimeConfig): SupabaseClient {
  return createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
}

export async function loadStoredSupabaseConfig() {
  const raw = await AsyncStorage.getItem(SUPABASE_CONFIG_KEY);
  if (!raw) return null;
  return JSON.parse(raw) as SupabaseRuntimeConfig;
}

export async function saveStoredSupabaseConfig(config: SupabaseRuntimeConfig) {
  await AsyncStorage.setItem(SUPABASE_CONFIG_KEY, JSON.stringify(config));
}

export async function clearStoredSupabaseConfig() {
  await AsyncStorage.removeItem(SUPABASE_CONFIG_KEY);
}
