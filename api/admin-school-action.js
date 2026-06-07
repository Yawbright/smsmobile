const { audit, centralClient, method, requireAdmin } = require("../api-lib/admin");

module.exports = async function handler(req, res) {
  if (!requireAdmin(req, res) || !method(req, res, ["POST"])) return;
  const id = String(req.body?.id || "");
  const action = String(req.body?.action || "");
  const status =
    action === "approve" ? "active" :
    action === "suspend" ? "suspended" :
    action === "reactivate" ? "active" :
    action === "reject" ? "rejected" : "";
  if (!id || (!status && action !== "delete")) return res.status(400).json({ message: "Choose a valid school action." });
  try {
    const db = centralClient();
    if (action === "delete") {
      const { data: existing } = await db.from("school_mobile_directory").select("*").eq("id", id).maybeSingle();
      const { error } = await db.from("school_mobile_directory").delete().eq("id", id);
      if (error) throw error;
      await audit(db, "school_deleted", existing, {});
      return res.status(200).json({ school: existing });
    }
    const { data, error } = await db
      .from("school_mobile_directory")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    await audit(db, `school_${action}`, data, { status });
    return res.status(200).json({ school: data });
  } catch (error) {
    return res.status(400).json({ message: error.message || "School action failed." });
  }
};
