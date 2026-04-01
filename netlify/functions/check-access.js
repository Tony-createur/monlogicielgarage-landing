const jwt = require("jsonwebtoken");

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

    if (!email || decoded.paid !== true) {
      return {
        statusCode: 401,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ok: false, reason: "invalid_token" }),
      };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true, email }),
    };
  } catch (err) {
    return {
      statusCode: 401,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: false, reason: "forbidden" }),
    };
  }
};
