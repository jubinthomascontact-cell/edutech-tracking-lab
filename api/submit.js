
const crypto = require("node:crypto");

module.exports = async function handler(req, res) {
  res.setHeader(
    "Access-Control-Allow-Origin",
    "https://jubinthomascontact-cell.github.io"
  );
  res.setHeader(
    "Access-Control-Allow-Methods",
    "POST, OPTIONS"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type"
  );

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed"
    });
  }

  const { event_type } = req.body || {};

  if (event_type !== "demo_request") {
    return res.status(400).json({
      success: false,
      error: "Invalid event type"
    });
  }

  const event_id = "demo_" + crypto.randomUUID();

  return res.status(200).json({
    success: true,
    event_id,
    message: "Demo request event received"
  });
};
