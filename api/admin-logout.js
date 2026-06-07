module.exports = async function handler(req, res) {
  res.setHeader("Set-Cookie", "sms_admin=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax; Secure");
  return res.status(200).json({ ok: true });
};
