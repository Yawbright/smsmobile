import { SupabaseClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from "react";

import {
  clearStoredSupabaseConfig,
  createSupabaseClient,
  envSupabaseConfig,
  hasConfig,
  loadStoredSupabaseConfig,
  saveStoredSupabaseConfig,
  SupabaseRuntimeConfig,
} from "../lib/supabase";
import { DEMO_CACHE_KEY } from "../lib/cacheKeys";
import { hasDirectoryConfig, lookupSchoolCode, registerSchoolConfig } from "../lib/schoolDirectory";

type SupabaseContextValue = {
  client: SupabaseClient | null;
  config: SupabaseRuntimeConfig;
  hasSupabaseConfig: boolean;
  isLoadingConfig: boolean;
  saveConfig: (config: SupabaseRuntimeConfig) => Promise<{ config: SupabaseRuntimeConfig; message: string }>;
  clearConfig: () => Promise<void>;
  testConfig: (config: SupabaseRuntimeConfig) => Promise<{ ok: boolean; message: string }>;
  directoryReady: boolean;
  setupWithSchoolCode: (schoolCode: string) => Promise<{ ok: boolean; message: string }>;
};

const SupabaseContext = createContext<SupabaseContextValue | null>(null);

async function clearDataCaches() {
  const keys = await AsyncStorage.getAllKeys();
  const cacheKeys = keys.filter((key) => key === DEMO_CACHE_KEY || key.startsWith("oterkpolu.mobile.cache.school."));
  await Promise.all(cacheKeys.map((key) => AsyncStorage.removeItem(key)));
}

async function saveSchoolIdentity(config: SupabaseRuntimeConfig) {
  if (!hasConfig(config) || !config.schoolCode) return;
  try {
    const schoolClient = createSupabaseClient(config);
    const { error } = await schoolClient.from("school_settings").upsert(
      {
        school_id: config.schoolId,
        school_code: config.schoolCode,
        school_name: config.schoolName ?? "",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "school_id" },
    );
    if (error) {
      console.warn("School identity cloud save skipped:", error.message);
    }
  } catch (error) {
    console.warn("School identity cloud save skipped:", error instanceof Error ? error.message : error);
  }
}

export function SupabaseProvider({ children }: PropsWithChildren) {
  const [config, setConfig] = useState<SupabaseRuntimeConfig>(envSupabaseConfig);
  const [isLoadingConfig, setLoadingConfig] = useState(true);

  useEffect(() => {
    loadStoredSupabaseConfig()
      .then((stored) => {
        if (stored && hasConfig(stored)) setConfig(stored);
      })
      .finally(() => setLoadingConfig(false));
  }, []);

  const client = useMemo(() => (hasConfig(config) ? createSupabaseClient(config) : null), [config]);

  const value = useMemo<SupabaseContextValue>(
    () => ({
      client,
      config,
      hasSupabaseConfig: Boolean(client),
      isLoadingConfig,
      directoryReady: hasDirectoryConfig(),
      async saveConfig(nextConfig) {
        let cleaned: SupabaseRuntimeConfig = {
          supabaseUrl: nextConfig.supabaseUrl.trim(),
          supabaseAnonKey: nextConfig.supabaseAnonKey.trim(),
          schoolId: nextConfig.schoolId.trim(),
          schoolName: nextConfig.schoolName?.trim() || "",
          schoolCode: nextConfig.schoolCode?.trim().toUpperCase() || "",
          approvalStatus: nextConfig.approvalStatus ?? "pending",
        };

        const result = await registerSchoolConfig(cleaned);
        cleaned = result.config;
        const message = `Registration submitted. School code: ${cleaned.schoolCode}. Status: ${result.status}.`;

        await clearDataCaches();
        await saveStoredSupabaseConfig(cleaned);
        setConfig(cleaned);
        return { config: cleaned, message };
      },
      async clearConfig() {
        await clearStoredSupabaseConfig();
        await clearDataCaches();
        setConfig(envSupabaseConfig);
      },
      async testConfig(nextConfig) {
        if (!nextConfig.supabaseUrl || !nextConfig.supabaseAnonKey) return { ok: false, message: "Enter URL and anon key." };
        try {
          const testClient = createSupabaseClient(nextConfig);
          const { error } = await testClient.rpc("mobile_login", {
            p_username: "__connection_test__",
            p_password: "__connection_test__",
          });
          if (!error) return { ok: true, message: "Connected. Login RPC responded." };
          if (error.message.toLowerCase().includes("invalid username")) {
            return { ok: true, message: "Connected. Login RPC exists." };
          }
          return { ok: false, message: error.message };
        } catch (error) {
          return { ok: false, message: error instanceof Error ? error.message : "Connection test failed." };
        }
      },
      async setupWithSchoolCode(schoolCode) {
        try {
          const result = await lookupSchoolCode(schoolCode);
          await clearDataCaches();
          await saveStoredSupabaseConfig(result.config);
          await saveSchoolIdentity(result.config);
          setConfig(result.config);
          return { ok: true, message: `${result.schoolName} setup saved.` };
        } catch (error) {
          return { ok: false, message: error instanceof Error ? error.message : "School code lookup failed." };
        }
      },
    }),
    [client, config, isLoadingConfig],
  );

  return <SupabaseContext.Provider value={value}>{children}</SupabaseContext.Provider>;
}

export function useSupabase() {
  const ctx = useContext(SupabaseContext);
  if (!ctx) throw new Error("useSupabase must be used inside SupabaseProvider");
  return ctx;
}
