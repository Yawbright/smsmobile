const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");

function requireAdmin(req, res) {
  const expected = process.env.ADMIN_PASSWORD;
  const secret = process.env.ADMIN_SESSION_SECRET || expected;
  const cookie = String(req.headers.cookie || "").split(";").map((v) => v.trim()).find((v) => v.startsWith("sms_admin="));
  const token = cookie ? cookie.split("=")[1] : "";
  const [body, sig] = token.split(".");
  if (!body || !sig || !secret) return res.status(401).json({ message: "Admin login required." }), false;
  const expectedSig = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  if (sig.length !== expectedSig.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) return res.status(401).json({ message: "Admin login required." }), false;
  const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  if (payload.exp < Date.now()) return res.status(401).json({ message: "Admin session expired." }), false;
  return true;
}

module.exports = async function handler(req, res) {
  if (!requireAdmin(req, res)) return;
  const school = req.body?.school || {};
  try {
    const db = createClient(school.supabase_url, school.supabase_anon_key);
    const settings = await db.from("school_settings").select("school_id").limit(1);
    const users = await db.from("school_users").select("user_id").limit(1);
    const rpc = await db.rpc("mobile_login", { p_username: "__connection_test__", p_password: "__connection_test__", p_school_id: school.school_id });
    return res.status(200).json({
      checks: [
        { label: "Supabase reachable", ok: !settings.error || !users.error },
        { label: "school_settings table", ok: !settings.error, message: settings.error?.message },
        { label: "school_users table", ok: !users.error, message: users.error?.message },
        { label: "mobile_login RPC", ok: !rpc.error || String(rpc.error.message || "").toLowerCase().includes("invalid"), message: rpc.error?.message },
      ],
    });
  } catch (error) {
    return res.status(400).json({ message: error.message || "Connection test failed." });
  }
};
