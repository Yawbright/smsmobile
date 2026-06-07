const { audit, centralClient, generateUniqueSchoolCode, method, requireAdmin } = require("../api-lib/admin");

module.exports = async function handler(req, res) {
  if (!requireAdmin(req, res) || !method(req, res, ["POST"])) return;
  const id = String(req.body?.id || "");
  if (!id) return res.status(400).json({ message: "School ID is required." });
  try {
    const db = centralClient();
    const { data: school, error: schoolError } = await db.from("school_mobile_directory").select("*").eq("id", id).single();
    if (schoolError) throw schoolError;
    const nextCode = await generateUniqueSchoolCode(db, school.school_name);
    const { data, error } = await db
      .from("school_mobile_directory")
      .update({ school_code: nextCode, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    await audit(db, "school_code_regenerated", data, { previous_code: school.school_code, next_code: nextCode });
    return res.status(200).json({ school: data });
  } catch (error) {
    return res.status(400).json({ message: error.message || "Could not regenerate school code." });
  }
};
