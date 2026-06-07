const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");

function requireAdmin(req, res) {
  const expected = process.env.ADMIN_PASSWORD;
  const secret = process.env.ADMIN_SESSION_SECRET || expected;
  const cookie = String(req.headers.cookie || "").split(";").map((v) => v.trim()).find((v) => v.startsWith("sms_admin="));
  const token = cookie ? cookie.split("=")[1] : "";
  const [body, sig] = token.split(".");
  if (!body || !sig || !secret) {
    res.status(401).json({ message: "Admin login required." });
    return false;
  }
  const expectedSig = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  if (sig.length !== expectedSig.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) {
    res.status(401).json({ message: "Admin login required." });
    return false;
  }
  const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  if (payload.exp < Date.now()) {
    res.status(401).json({ message: "Admin session expired." });
    return false;
  }
  return true;
}

function client() {
  const url = process.env.CENTRAL_SUPABASE_URL;
  const key = process.env.CENTRAL_SUPABASE_SERVICE_ROLE_KEY || process.env.CENTRAL_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Central Supabase is not configured.");
  return createClient(url, key);
}

module.exports = async function handler(req, res) {
  if (!requireAdmin(req, res)) return;
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ message: "Method not allowed" });
  }
  try {
    const db = client();
    const [{ data: schools, error: schoolError }, { data: licenses, error: licenseError }] = await Promise.all([
      db.from("school_mobile_directory").select("*").order("created_at", { ascending: false }),
      db.from("school_licenses").select("*").order("created_at", { ascending: false }),
    ]);
    if (schoolError) throw schoolError;
    if (licenseError && !String(licenseError.message || "").includes("does not exist")) throw licenseError;
    return res.status(200).json({ schools: schools || [], licenses: licenses || [] });
  } catch (error) {
    return res.status(400).json({ message: error.message || "Could not load schools." });
  }
};
