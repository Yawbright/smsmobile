const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");

const SALT = "SMS_LICENSE_SALT_2025_v2";
const LICENSE_PREFIX = "RC";

function centralClient() {
  const url = process.env.CENTRAL_SUPABASE_URL;
  const key = process.env.CENTRAL_SUPABASE_SERVICE_ROLE_KEY || process.env.CENTRAL_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Central Supabase is not configured.");
  return createClient(url, key);
}

function requireAdmin(req, res) {
  const expected = process.env.ADMIN_PASSWORD;
  const secret = process.env.ADMIN_SESSION_SECRET || expected;
  const cookie = String(req.headers.cookie || "").split(";").map((v) => v.trim()).find((v) => v.startsWith("sms_admin="));
  const token = cookie ? cookie.split("=")[1] : "";
  const [body, sig] = token.split(".");
  if (!body || !sig || !secret) return res.status(401).json({ message: "Admin login required." }), false;
  const expectedSig = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  if (sig.length !== expectedSig.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) {
    return res.status(401).json({ message: "Admin login required." }), false;
  }
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (payload.exp < Date.now()) return res.status(401).json({ message: "Admin session expired." }), false;
  } catch {
    return res.status(401).json({ message: "Admin login required." }), false;
  }
  return true;
}

function schoolCodePart(name) {
  const words = String(name || "").toUpperCase().split(/\s+/).filter((w) => w && !["THE", "OF", "AND", "A"].includes(w));
  if (!words.length) return String(name || "SCH").slice(0, 6).toUpperCase().replace(/\s/g, "") || "SCH";
  return words.map((w) => w[0]).join("").slice(0, 6) || "SCH";
}

function generateLicenseKey(schoolName, year) {
  const raw = `${String(schoolName).toUpperCase().trim()}|${year}|${SALT}`;
  const digest = crypto.createHash("sha256").update(raw).digest("hex").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return `${LICENSE_PREFIX}-${year}-${digest.slice(0, 12)}-${schoolCodePart(schoolName)}`;
}

async function generateUniqueSchoolCode(db, schoolName) {
  const prefix = schoolCodePart(schoolName).slice(0, 5) || "SCH";
  for (let i = 0; i < 12; i += 1) {
    const suffix = crypto.randomBytes(3).toString("hex").toUpperCase();
    const code = `${prefix}-${suffix}`;
    const { data, error } = await db.from("school_mobile_directory").select("id").eq("school_code", code).maybeSingle();
    if (error) throw error;
    if (!data) return code;
  }
  throw new Error("Could not generate a unique school code.");
}

async function audit(db, action, school, details = {}) {
  try {
    await db.from("admin_audit_log").insert({
      action,
      school_id: school?.school_id || null,
      school_code: school?.school_code || null,
      school_name: school?.school_name || null,
      details,
    });
  } catch {
    // Audit logging must not block the primary admin action.
  }
}

function method(req, res, allowed) {
  if (allowed.includes(req.method)) return true;
  res.setHeader("Allow", allowed.join(", "));
  res.status(405).json({ message: "Method not allowed" });
  return false;
}

module.exports = {
  audit,
  centralClient,
  generateLicenseKey,
  generateUniqueSchoolCode,
  method,
  requireAdmin,
};
