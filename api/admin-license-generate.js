const { audit, centralClient, generateLicenseKey, method, requireAdmin } = require("../api-lib/admin");

module.exports = async function handler(req, res) {
  if (!requireAdmin(req, res) || !method(req, res, ["POST"])) return;
  const school = req.body?.school || {};
  const academicYear = String(req.body?.academicYear || "");
  const licenseType = String(req.body?.licenseType || "full_year");
  const activatedTerms = licenseType === "full_year" ? [] : (req.body?.activatedTerms || []);
  const maxDevices = Number(req.body?.maxDevices || 1);
  const expiresAt = req.body?.expiresAt || null;
  const notes = String(req.body?.notes || "");
  if (!school.school_name || !school.school_code || !academicYear) {
    return res.status(400).json({ message: "School and academic year are required." });
  }
  const licenseKey = generateLicenseKey(school.school_name, academicYear);
  const record = {
    license_key: licenseKey,
    school_id: school.school_id,
    school_code: school.school_code,
    school_name: school.school_name,
    academic_year: academicYear,
    license_type: licenseType,
    activated_terms: activatedTerms,
    max_machines: maxDevices,
    registered_hwids: [],
    is_active: true,
    expires_at: expiresAt || null,
    notes,
    updated_at: new Date().toISOString(),
  };
  try {
    const db = centralClient();
    const { data, error } = await db.from("school_licenses").upsert(record, { onConflict: "license_key" }).select("*").single();
    if (error) throw error;
    await audit(db, "license_generated", school, { license_key: data.license_key, academic_year: academicYear, license_type: licenseType });
    return res.status(200).json({ license: data });
  } catch (error) {
    return res.status(400).json({ message: error.message || "License generation failed." });
  }
};
