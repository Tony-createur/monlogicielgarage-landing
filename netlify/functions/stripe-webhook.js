import Stripe from "stripe";
import jwt from "jsonwebtoken";
import { Resend } from "resend";
import { getStore } from "@netlify/blobs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const resend = new Resend(process.env.RESEND_API_KEY);

export default async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const signature = req.headers.get("stripe-signature");
  const body = await req.text();

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const email = (session.customer_details?.email || session.customer_email || "").toLowerCase();

    if (!email) {
      return new Response("No email found", { status: 200 });
    }

    const customers = getStore("paid-customers");

    await customers.set(email, JSON.stringify({
      email,
      paid: true,
      stripeSessionId: session.id,
      paidAt: new Date().toISOString()
    }));

    const token = jwt.sign(
      { email, paid: true },
      process.env.JWT_SECRET,
      { expiresIn: "30d" }
    );

    const accessLink = `${process.env.APP_BASE_URL}/acces.html?token=${encodeURIComponent(token)}`;

    try {
      await resend.emails.send({
        from: process.env.EMAIL_FROM,
        to: [email],
        subject: "Votre accès à Mon Logiciel Garage",
        html: `
          <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;color:#111;">
            <h2>Bienvenue sur Mon Logiciel Garage</h2>
            <p>Votre paiement a bien été confirmé.</p>
            <p>Voici votre lien d’accès sécurisé :</p>
            <p><a href="${accessLink}">${accessLink}</a></p>
            <p>Conservez cet email pour revenir sur votre espace.</p>
          </div>
        `
      });
    } catch (e) {
      console.error("Email error:", e);
    }
  }

  return new Response("OK", { status: 200 });
};

export const config = {
  path: "/.netlify/functions/stripe-webhook"
};
