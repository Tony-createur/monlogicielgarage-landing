import jwt from "jsonwebtoken";
import { getStore } from "@netlify/blobs";

export default async (req) => {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    if (!token) {
      return Response.json({ ok: false, reason: "missing_token" }, { status: 401 });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const email = (decoded.email || "").toLowerCase();

    if (!email) {
      return Response.json({ ok: false, reason: "invalid_token" }, { status: 401 });
    }

    const customers = getStore("paid-customers");
    const record = await customers.get(email, { type: "json" });

    if (!record || !record.paid) {
      return Response.json({ ok: false, reason: "not_paid" }, { status: 403 });
    }

    return Response.json({ ok: true, email });
  } catch (err) {
    return Response.json({ ok: false, reason: "forbidden" }, { status: 401 });
  }
};

export const config = {
  path: "/.netlify/functions/check-access"
};
