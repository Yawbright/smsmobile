const crypto = require("crypto");

function sign(payload, secret) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ message: "Method not allowed" });
  }

  const password = String(req.body?.password || "");
  const expected = process.env.ADMIN_PASSWORD;
  const secret = process.env.ADMIN_SESSION_SECRET || expected;
  if (!expected || !secret) return res.status(500).json({ message: "Admin auth is not configured." });
  if (password !== expected) return res.status(401).json({ message: "Incorrect admin password." });

  const token = sign({ role: "admin", exp: Date.now() + 1000 * 60 * 60 * 12 }, secret);
  res.setHeader("Set-Cookie", `sms_admin=${token}; HttpOnly; Path=/; Max-Age=43200; SameSite=Lax; Secure`);
  return res.status(200).json({ ok: true });
};
