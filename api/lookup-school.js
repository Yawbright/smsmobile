const { createClient } = require("@supabase/supabase-js");

function getCentralConfig() {
  return {
    url: process.env.CENTRAL_SUPABASE_URL,
    key: process.env.CENTRAL_SUPABASE_SERVICE_ROLE_KEY || process.env.CENTRAL_SUPABASE_ANON_KEY,
  };
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { url, key } = getCentralConfig();
  if (!url || !key) return res.status(500).json({ message: "Central directory is not configured." });

  const schoolCode = String(req.body?.schoolCode || "").trim().toUpperCase();
  if (!schoolCode) return res.status(400).json({ message: "Enter a school code." });

  try {
    const client = createClient(url, key);
    const { data, error } = await client.rpc("lookup_school_mobile_config", {
      p_school_code: schoolCode,
    });
    if (error) throw error;
    if (!data) return res.status(404).json({ message: "School code not found." });
    if (data.status === "pending") {
      return res.status(403).json({ message: "This school is pending central admin approval.", status: "pending" });
    }
    if (data.status === "suspended") {
      return res.status(403).json({ message: "This school has been suspended.", status: "suspended" });
    }
    const { data: licenses, error: licenseError } = await client
      .from("school_licenses")
      .select("license_key,is_active,expires_at")
      .eq("school_id", data.school_id)
      .eq("is_active", true)
      .limit(1);
    if (licenseError) throw licenseError;
    if (!licenses?.length) {
      return res.status(403).json({ message: "This school is approved but does not have an active license yet.", status: "unlicensed" });
    }
    const activeLicense = licenses[0];
    if (activeLicense.expires_at && new Date(activeLicense.expires_at).getTime() < Date.now()) {
      return res.status(403).json({ message: "This school's license has expired.", status: "expired" });
    }
    return res.status(200).json(data);
  } catch (error) {
    return res.status(400).json({ message: error.message || "School lookup failed." });
  }
};
