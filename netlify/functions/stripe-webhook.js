const Stripe = require("stripe");
const jwt = require("jsonwebtoken");
const { getStore } = require("@netlify/blobs");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 200,
        body: "Webhook OK",
      };
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return {
        statusCode: 500,
        body: "Missing STRIPE_SECRET_KEY",
      };
    }

    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      return {
        statusCode: 500,
        body: "Missing STRIPE_WEBHOOK_SECRET",
      };
    }

    if (!process.env.JWT_SECRET) {
      return {
        statusCode: 500,
        body: "Missing JWT_SECRET",
      };
    }

    if (!process.env.RESEND_API_KEY) {
      return {
        statusCode: 500,
        body: "Missing RESEND_API_KEY",
      };
    }

    if (!process.env.MAIL_FROM) {
      return {
        statusCode: 500,
        body: "Missing MAIL_FROM",
      };
    }

    if (!process.env.APP_BASE_URL) {
      return {
        statusCode: 500,
        body: "Missing APP_BASE_URL",
      };
    }

    const signature =
      event.headers["stripe-signature"] || event.headers["Stripe-Signature"];

    if (!signature) {
      return {
        statusCode: 400,
        body: "Missing Stripe signature",
      };
    }

    const rawBody = event.isBase64Encoded
      ? Buffer.from(event.body, "base64")
      : Buffer.from(event.body, "utf8");

    const stripeEvent = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    console.log("📩 Event reçu :", stripeEvent.type);

    if (stripeEvent.type === "checkout.session.completed") {
      const session = stripeEvent.data.object;

      const email = (
        session.customer_details?.email ||
        session.customer_email ||
        ""
      ).toLowerCase().trim();

      if (!email) {
        console.error("❌ Aucun email trouvé dans la session");
        return {
          statusCode: 400,
          body: "No email in checkout session",
        };
      }

      console.log("✅ Paiement réussi :", session.id, email);

      const customers = getStore("paid-customers");
      await customers.set(
        email,
        JSON.stringify({
          paid: true,
          email,
          sessionId: session.id,
          paidAt: new Date().toISOString(),
        })
      );

      console.log("💾 Client sauvegardé");

      const token = jwt.sign({ email }, process.env.JWT_SECRET, {
        expiresIn: "30d",
      });

      const accessUrl = `${process.env.APP_BASE_URL}/acces.html?token=${encodeURIComponent(token)}`;
      console.log("🔗 Lien généré");

      const resendResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.MAIL_FROM,
          to: email,
          subject: "Votre accès à Mon Logiciel Garage",
          html: `
            <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111">
              <h2>Merci pour votre abonnement</h2>
              <p>Votre paiement a bien été validé.</p>
              <p>Voici votre lien d’accès :</p>
              <p>
                <a href="${accessUrl}" style="display:inline-block;padding:12px 18px;background:#111;color:#fff;text-decoration:none;border-radius:8px">
                  Accéder au logiciel
                </a>
              </p>
              <p>Ou copiez ce lien :</p>
              <p>${accessUrl}</p>
            </div>
          `,
        }),
      });

      const resendText = await resendResponse.text();
      console.log("📨 Resend status:", resendResponse.status);
      console.log("📨 Resend réponse:", resendText);

      if (!resendResponse.ok) {
        return {
          statusCode: 500,
          body: `Resend error: ${resendText}`,
        };
      }

      console.log("✅ Email envoyé");
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ received: true }),
    };
  } catch (err) {
    console.error("❌ Webhook error:", err);

    return {
      statusCode: 400,
      body: `Webhook Error: ${err.message}`,
    };
  }
};
