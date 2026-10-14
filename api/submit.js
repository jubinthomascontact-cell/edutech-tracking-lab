
module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Only POST requests are allowed"
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
    event_id: event_id,
    message: "Demo request event received"
  });
};
