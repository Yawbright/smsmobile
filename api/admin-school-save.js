const { audit, centralClient, method, requireAdmin } = require("./_admin");

module.exports = async function handler(req, res) {
  if (!requireAdmin(req, res) || !method(req, res, ["POST"])) return;
  const id = String(req.body?.id || "");
  const patch = req.body?.patch || {};
  if (!id) return res.status(400).json({ message: "School ID is required." });
  const allowed = {};
  for (const key of ["school_name", "supabase_url", "supabase_anon_key", "status"]) {
    if (patch[key] !== undefined) allowed[key] = String(patch[key]).trim();
  }
  allowed.updated_at = new Date().toISOString();
  try {
    const db = centralClient();
    const { data, error } = await db.from("school_mobile_directory").update(allowed).eq("id", id).select("*").single();
    if (error) throw error;
    await audit(db, "school_updated", data, { fields: Object.keys(allowed).filter((key) => key !== "updated_at") });
    return res.status(200).json({ school: data });
  } catch (error) {
    return res.status(400).json({ message: error.message || "Could not save school." });
  }
};
