const crypto = require("node:crypto");

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const expected = process.env.COORDINATOR_SYNC_TOKEN;
  const supplied = (req.headers.authorization || "").replace(/^Bearer /i, "");

  if (!expected || !supplied ||
      Buffer.byteLength(expected) !== Buffer.byteLength(supplied) ||
      !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(supplied))) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    return res.status(500).json({ error: "Server not configured" });
  }

  try {
    const response = await fetch(
      url.replace(/\/$/, "") +
      "/rest/v1/Leads?select=id,created_at,school_name,enquirer_role,primary_need,lead_source,utm_campaign,lead_status,call_remarks,follow_up_date&order=id.asc&limit=500",
      { headers: { apikey: key } }
    );

    if (!response.ok) {
      console.error("Lead sync read failed:", response.status);
      return res.status(502).json({ error: "Unable to retrieve leads" });
    }

    return res.status(200).json({ leads: await response.json() });
  } catch (error) {
    console.error("Lead sync error:", error.message);
    return res.status(502).json({ error: "Unable to retrieve leads" });
  }
};
