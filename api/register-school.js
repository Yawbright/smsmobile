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

  const schoolName = String(req.body?.schoolName || "").trim();
  const supabaseUrl = String(req.body?.supabaseUrl || "").trim();
  const supabaseAnonKey = String(req.body?.supabaseAnonKey || "").trim();

  if (!schoolName || !supabaseUrl || !supabaseAnonKey) {
    return res.status(400).json({ message: "Enter school name, Supabase URL and anon key." });
  }

  try {
    const client = createClient(url, key);
    const { data, error } = await client.rpc("register_school_mobile_config", {
      p_school_name: schoolName,
      p_supabase_url: supabaseUrl,
      p_supabase_anon_key: supabaseAnonKey,
    });
    if (error) throw error;
    if (!data) return res.status(400).json({ message: "School registration did not return a school code." });
    return res.status(200).json(data);
  } catch (error) {
    return res.status(400).json({ message: error.message || "School registration failed." });
  }
};
