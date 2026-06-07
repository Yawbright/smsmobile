const { centralClient, method } = require("./_admin");

function parseList(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try { return JSON.parse(value); } catch { return []; }
  }
  return [];
}

module.exports = async function handler(req, res) {
  if (!method(req, res, ["POST"])) return;
  const schoolCode = String(req.body?.schoolCode || "").trim().toUpperCase();
  const schoolId = String(req.body?.schoolId || "").trim();
  const hwid = String(req.body?.hwid || "").trim().toUpperCase();
  const academicYear = String(req.body?.academicYear || "").trim();
  const term = String(req.body?.term || "").trim();
  if ((!schoolCode && !schoolId) || !hwid || !academicYear || !term) {
    return res.status(400).json({ allowed: false, message: "School, device, year and term are required." });
  }
  try {
    const db = centralClient();
    const schoolQuery = db.from("school_mobile_directory").select("*").limit(1);
    const { data: schoolRows, error: schoolError } = schoolId
      ? await schoolQuery.eq("school_id", schoolId)
      : await schoolQuery.eq("school_code", schoolCode);
    if (schoolError) throw schoolError;
    const school = schoolRows?.[0];
    if (!school) return res.status(404).json({ allowed: false, message: "School not found." });
    if (school.status !== "active") return res.status(403).json({ allowed: false, message: `School is ${school.status}.` });

    const { data: licenses, error: licenseError } = await db
      .from("school_licenses")
      .select("*")
      .eq("school_id", school.school_id)
      .eq("academic_year", academicYear)
      .order("created_at", { ascending: false });
    if (licenseError) throw licenseError;
    const license = (licenses || []).find((item) => item.is_active);
    if (!license) return res.status(403).json({ allowed: false, message: "No active license for this academic year." });
    if (license.expires_at && new Date(license.expires_at).getTime() < Date.now()) {
      return res.status(403).json({ allowed: false, message: "License has expired." });
    }
    const terms = parseList(license.activated_terms);
    if (license.license_type !== "full_year" && !terms.includes(term)) {
      return res.status(403).json({ allowed: false, message: `${term} is not activated for this license.` });
    }
    const hwids = parseList(license.registered_hwids).map((item) => String(item).toUpperCase());
    if (!hwids.includes(hwid)) {
      if (hwids.length >= Number(license.max_machines || 1)) {
        return res.status(403).json({ allowed: false, message: `Maximum devices (${license.max_machines}) reached.` });
      }
      hwids.push(hwid);
      await db.from("school_licenses").update({ registered_hwids: hwids, updated_at: new Date().toISOString() }).eq("license_key", license.license_key);
    }
    await db.from("school_license_devices").upsert({
      license_key: license.license_key,
      school_id: school.school_id,
      school_code: school.school_code,
      hwid,
      academic_year: academicYear,
      term,
      last_seen_at: new Date().toISOString(),
    }, { onConflict: "license_key,hwid" });
    return res.status(200).json({
      allowed: true,
      message: "License active.",
      license,
      school: { school_id: school.school_id, school_code: school.school_code, school_name: school.school_name },
    });
  } catch (error) {
    return res.status(400).json({ allowed: false, message: error.message || "License check failed." });
  }
};
