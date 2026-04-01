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

    const signature =
      event.headers["stripe-signature"] || event.headers["Stripe-Signature"];

    if (!signature) {
      return {
        statusCode: 400,
        body: "Missing Stripe signature",
      };
    }

    const stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    if (stripeEvent.type === "checkout.session.completed") {
      const session = stripeEvent.data.object;

      const email = (
        session.customer_details?.email ||
        session.customer_email ||
        ""
      ).toLowerCase().trim();

      if (!email) {
        console.error("❌ Aucun email trouvé dans la session Stripe");
        return {
          statusCode: 400,
          body: "No customer email found",
        };
      }

      console.log("✅ Paiement réussi :", session.id, email);

      // 1) Sauvegarde client payé dans Netlify Blobs
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

      // 2) Génération du token d'accès
      const token = jwt.sign(
        { email },
        process.env.JWT_SECRET,
        { expiresIn: "30d" }
      );

      const accessUrl = `${process.env.APP_BASE_URL}/acces.html?token=${encodeURIComponent(token)}`;

      // 3) Envoi du mail via Resend
      const resendResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
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
                  Accéder à l’application
                </a>
              </p>
              <p>Ou copiez ce lien dans votre navigateur :</p>
              <p>${accessUrl}</p>
            </div>
          `,
        }),
      });

      const resendData = await resendResponse.text();
      console.log("📨 Réponse Resend :", resendResponse.status, resendData);

      if (!resendResponse.ok) {
        return {
          statusCode: 500,
          body: `Email send failed: ${resendData}`,
        };
      }
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
