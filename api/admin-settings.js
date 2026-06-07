const { audit, centralClient, method, requireAdmin } = require("../api-lib/admin");

module.exports = async function handler(req, res) {
  if (!requireAdmin(req, res) || !method(req, res, ["GET", "POST"])) return;
  try {
    const db = centralClient();
    if (req.method === "GET") {
      const { data, error } = await db.from("platform_settings").select("*").eq("id", "default").maybeSingle();
      if (error) throw error;
      return res.status(200).json({ settings: data });
    }
    const patch = req.body?.settings || {};
    const record = {
      id: "default",
      maintenance_mode: Boolean(patch.maintenance_mode),
      maintenance_message: String(patch.maintenance_message || ""),
      minimum_desktop_version: String(patch.minimum_desktop_version || ""),
      support_message: String(patch.support_message || ""),
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await db.from("platform_settings").upsert(record, { onConflict: "id" }).select("*").single();
    if (error) throw error;
    await audit(db, "platform_settings_updated", null, record);
    return res.status(200).json({ settings: data });
  } catch (error) {
    return res.status(400).json({ message: error.message || "Settings request failed." });
  }
};
