const jwt = require("jsonwebtoken");

exports.handler = async (event) => {
  try {
    const token = event.queryStringParameters?.token;

    if (!token) {
      return {
        statusCode: 401,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ok: false,
          message: "Token manquant.",
          reason: "missing_token",
        }),
      };
    }

    if (!process.env.JWT_SECRET) {
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ok: false,
          message: "JWT_SECRET non configuré sur Netlify.",
          reason: "missing_jwt_secret",
        }),
      };
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const email = (decoded.email || "").toLowerCase().trim();

    if (!email || decoded.paid !== true) {
      return {
        statusCode: 401,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ok: false,
          message: "Token invalide.",
          reason: "invalid_token",
        }),
      };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ok: true,
        email,
      }),
    };
  } catch (err) {
    return {
      statusCode: 401,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ok: false,
        message: "Accès refusé ou lien expiré.",
        reason: "forbidden",
      }),
    };
  }
};
