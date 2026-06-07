import { directoryApiUrl, SupabaseRuntimeConfig } from "./supabase";

type DirectoryResult = {
  school_code?: string;
  school_name?: string;
  supabase_url?: string;
  supabase_anon_key?: string;
  school_id?: string;
  status?: "pending" | "active" | "suspended" | "rejected";
};

function getApiBaseUrl() {
  if (directoryApiUrl) return directoryApiUrl.replace(/\/$/, "");
  if (typeof window !== "undefined" && window.location?.origin) return window.location.origin;
  return "";
}

async function postDirectory(path: string, payload: Record<string, unknown>) {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) {
    throw new Error("School directory API is not configured in this app build.");
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body?.message || body?.error || "School directory request failed.");
  }
  if (!body || typeof body !== "object" || !Object.keys(body).length) {
    throw new Error("School directory API did not return registration details. Check the Vercel API deployment.");
  }
  return body as DirectoryResult;
}

export function hasDirectoryConfig() {
  return Boolean(getApiBaseUrl());
}

export async function lookupSchoolCode(code: string): Promise<{ config: SupabaseRuntimeConfig; schoolName: string }> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) throw new Error("Enter a school code.");

  const row = await postDirectory("/api/lookup-school", { schoolCode: normalized });
  if (!row.supabase_url || !row.supabase_anon_key || !row.school_id || !row.school_name) {
    throw new Error("School directory returned incomplete setup details.");
  }

  return {
    schoolName: row.school_name,
    config: {
      supabaseUrl: row.supabase_url,
      supabaseAnonKey: row.supabase_anon_key,
      schoolId: row.school_id,
      schoolName: row.school_name,
      schoolCode: row.school_code ?? normalized,
      approvalStatus: row.status ?? "active",
    },
  };
}

export async function registerSchoolConfig(
  config: Pick<SupabaseRuntimeConfig, "schoolName" | "supabaseUrl" | "supabaseAnonKey">,
): Promise<{ config: SupabaseRuntimeConfig; schoolName: string; status: string }> {
  const row = await postDirectory("/api/register-school", {
    schoolName: config.schoolName?.trim(),
    supabaseUrl: config.supabaseUrl.trim(),
    supabaseAnonKey: config.supabaseAnonKey.trim(),
  });
  if (!row.school_code || !row.school_id || !row.school_name) {
    throw new Error("School registration returned incomplete details. Check the central Supabase function and Vercel API route.");
  }

  return {
    schoolName: row.school_name,
    status: row.status ?? "pending",
    config: {
      supabaseUrl: config.supabaseUrl.trim(),
      supabaseAnonKey: config.supabaseAnonKey.trim(),
      schoolId: row.school_id ?? "",
      schoolName: row.school_name,
      schoolCode: row.school_code,
      approvalStatus: row.status ?? "pending",
    },
  };
}
