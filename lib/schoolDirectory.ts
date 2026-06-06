import { createClient } from "@supabase/supabase-js";

import { directorySupabaseAnonKey, directorySupabaseUrl, SupabaseRuntimeConfig } from "./supabase";

type DirectoryResult = {
  school_code?: string;
  school_name: string;
  supabase_url: string;
  supabase_anon_key: string;
  school_id: string;
};

export function hasDirectoryConfig() {
  return Boolean(directorySupabaseUrl && directorySupabaseAnonKey);
}

export async function lookupSchoolCode(code: string): Promise<{ config: SupabaseRuntimeConfig; schoolName: string }> {
  if (!hasDirectoryConfig()) {
    throw new Error("Central school directory is not configured in this app build.");
  }
  const normalized = code.trim().toUpperCase();
  if (!normalized) throw new Error("Enter a school code.");

  const client = createClient(directorySupabaseUrl, directorySupabaseAnonKey);
  const { data, error } = await client.rpc("lookup_school_mobile_config", {
    p_school_code: normalized,
  });

  if (error) throw new Error(error.message);
  if (!data) throw new Error("School code not found.");

  const row = data as DirectoryResult;

  return {
    schoolName: row.school_name,
    config: {
      supabaseUrl: row.supabase_url,
      supabaseAnonKey: row.supabase_anon_key,
      schoolId: row.school_id,
      schoolName: row.school_name,
      schoolCode: row.school_code ?? normalized,
    },
  };
}
