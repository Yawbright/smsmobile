const { audit, centralClient, method, requireAdmin } = require("./_admin");

module.exports = async function handler(req, res) {
  if (!requireAdmin(req, res) || !method(req, res, ["POST"])) return;
  const licenseKey = String(req.body?.licenseKey || "").trim().toUpperCase();
  const action = String(req.body?.action || "");
  if (!licenseKey) return res.status(400).json({ message: "License key is required." });
  try {
    const db = centralClient();
    let update = {};
    if (action === "deactivate") update = { is_active: false };
    else if (action === "reactivate") update = { is_active: true };
    else if (action === "clear_devices") update = { registered_hwids: [] };
    else return res.status(400).json({ message: "Choose a valid license action." });
    update.updated_at = new Date().toISOString();
    const { data, error } = await db.from("school_licenses").update(update).eq("license_key", licenseKey).select("*").single();
    if (error) throw error;
    if (action === "clear_devices") {
      await db.from("school_license_devices").delete().eq("license_key", licenseKey);
    }
    await audit(db, `license_${action}`, data, { license_key: licenseKey });
    return res.status(200).json({ license: data });
  } catch (error) {
    return res.status(400).json({ message: error.message || "License action failed." });
  }
};
