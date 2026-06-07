const { centralClient, method, requireAdmin } = require("./_admin");

module.exports = async function handler(req, res) {
  if (!requireAdmin(req, res) || !method(req, res, ["GET"])) return;
  try {
    const db = centralClient();
    const [schoolsRes, licensesRes, auditRes, settingsRes, devicesRes] = await Promise.all([
      db.from("school_mobile_directory").select("*").order("created_at", { ascending: false }),
      db.from("school_licenses").select("*").order("created_at", { ascending: false }),
      db.from("admin_audit_log").select("*").order("created_at", { ascending: false }).limit(100),
      db.from("platform_settings").select("*").eq("id", "default").maybeSingle(),
      db.from("school_license_devices").select("*").order("last_seen_at", { ascending: false }),
    ]);
    if (schoolsRes.error) throw schoolsRes.error;
    if (licensesRes.error) throw licensesRes.error;
    if (auditRes.error) throw auditRes.error;
    if (settingsRes.error) throw settingsRes.error;
    if (devicesRes.error) throw devicesRes.error;
    return res.status(200).json({
      schools: schoolsRes.data || [],
      licenses: licensesRes.data || [],
      audit: auditRes.data || [],
      settings: settingsRes.data || null,
      devices: devicesRes.data || [],
      api: {
        baseUrl: "https://smsmobile.vercel.app",
        centralConfigured: Boolean(process.env.CENTRAL_SUPABASE_URL),
      },
    });
  } catch (error) {
    return res.status(400).json({ message: error.message || "Could not load dashboard." });
  }
};
