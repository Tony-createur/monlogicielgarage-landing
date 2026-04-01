const jwt = require("jsonwebtoken");
const { getStore } = require("@netlify/blobs");

exports.handler = async (event) => {
  try {
    const token = event.queryStringParameters?.token;

    if (!token) {
      return {
        statusCode: 401,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ok: false, reason: "missing_token" }),
      };
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const email = (decoded.email || "").toLowerCase().trim();

    if (!email) {
      return {
        statusCode: 401,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ok: false, reason: "invalid_token" }),
      };
    }

    const customers = getStore("paid-customers");
    const record = await customers.get(email, { type: "json" });

    if (!record || !record.paid) {
      return {
        statusCode: 403,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ok: false, reason: "not_paid" }),
      };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true, email }),
    };
  } catch (err) {
    console.error("❌ check-access error:", err);

    return {
      statusCode: 401,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: false, reason: "forbidden" }),
    };
  }
};
