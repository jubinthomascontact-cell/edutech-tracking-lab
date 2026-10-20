
const crypto = require("node:crypto");

module.exports = async function handler(req, res) {
  res.setHeader(
    "Access-Control-Allow-Origin",
    "https://jubinthomascontact-cell.github.io"
  );
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed"
    });
  }

  const { event_type, attribution, school_name, enquirer_role, primary_need } = req.body || {};

  if (event_type !== "demo_request") {
    return res.status(400).json({
      success: false,
      error: "Invalid event type"
    });
  }

  const allowedRoles = ["Principal", "IT coordinator", "Procurement", "Teacher", "Other"];
  const allowedNeeds = ["Interactive panels", "Installation support", "Teacher training"];
  if (typeof school_name !== "string" || !school_name.trim() || school_name.trim().length > 90 ||
      !allowedRoles.includes(enquirer_role) || !allowedNeeds.includes(primary_need)) {
    return res.status(400).json({ success: false, error: "Invalid demo enquiry details" });
  }

  const cleanUtm = (value) => {
    if (typeof value !== "string") return null;
    return value.trim().slice(0, 200) || null;
  };

  const utm = {
    utm_source: cleanUtm(attribution?.utm_source),
    utm_medium: cleanUtm(attribution?.utm_medium),
    utm_campaign: cleanUtm(attribution?.utm_campaign),
    utm_content: cleanUtm(attribution?.utm_content),
    utm_term: cleanUtm(attribution?.utm_term)
  };

  const event_id = "demo_" + crypto.randomUUID();

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase configuration");

    return res.status(500).json({
      success: false,
      error: "Database configuration unavailable"
    });
  }

  try {
    const response = await fetch(
      `${supabaseUrl.replace(/\/$/, "")}/rest/v1/Leads`,
      {
        method: "POST",
        headers: {
          "apikey": supabaseKey,
          "Content-Type": "application/json",
          "Prefer": "return=representation"
        },
        body: JSON.stringify({
          school_name: school_name.trim(),
          enquirer_role,
          primary_need,
          lead_source: utm.utm_source || "website",
          lead_status: "new",
          revenue: 0,
          first_touch_source: utm.utm_source || "website",
          last_touch_source: utm.utm_source || "website",
          ...utm
        })
      }
    );

    if (!response.ok) {
      console.error(
        "Supabase insert failed:",
        response.status,
        await response.text()
      );

      return res.status(500).json({
        success: false,
        error: "Unable to save lead"
      });
    }

    const savedLeads = await response.json();

    if (!Array.isArray(savedLeads) || savedLeads.length !== 1) {
      return res.status(500).json({
        success: false,
        error: "Lead confirmation failed"
      });
    }

    return res.status(200).json({
      success: true,
      event_id,
      lead_id: savedLeads[0].id,
      message: "Demo request saved successfully"
    });

  } catch (error) {
    console.error("Database request failed:", error);

    return res.status(500).json({
      success: false,
      error: "Database connection failed"
    });
  }
};
