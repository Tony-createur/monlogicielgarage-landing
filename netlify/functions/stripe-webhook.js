const Stripe = require("stripe");
const jwt = require("jsonwebtoken");
const { getStore } = require("@netlify/blobs");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  try {
    // ✅ Test simple (GET)
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 200,
        body: "Webhook OK",
      };
    }

    // ✅ Signature Stripe
    const signature =
      event.headers["stripe-signature"] || event.headers["Stripe-Signature"];

    if (!signature) {
      return {
        statusCode: 400,
        body: "Missing Stripe signature",
      };
    }

    // 🔥 CORRECTION CRITIQUE ICI
    const stripeEvent = stripe.webhooks.constructEvent(
      Buffer.from(event.body, "utf8"),
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    console.log("📩 Event reçu :", stripeEvent.type);

    // ✅ Paiement validé
    if (stripeEvent.type === "checkout.session.completed") {
      const session = stripeEvent.data.object;

      const email = (
        session.customer_details?.email ||
        session.customer_email ||
        ""
      ).toLowerCase().trim();

      if (!email) {
        console.error("❌ Aucun email trouvé");
        return {
          statusCode: 400,
          body: "No email",
        };
      }

      console.log("✅ Paiement réussi :", session.id, email);

      // ✅ Stockage client payé
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

      // ✅ Token sécurisé
      const token = jwt.sign(
        { email },
        process.env.JWT_SECRET,
        { expiresIn: "30d" }
      );

      const accessUrl = `${process.env.APP_BASE_URL}/acces.html?token=${encodeURIComponent(token)}`;

      console.log("🔗 Lien généré :", accessUrl);

      // ✅ Envoi email
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

      const resendData = await resendResponse.text();

      console.log("📨 Resend status:", resendResponse.status);
      console.log("📨 Resend réponse:", resendData);

      if (!resendResponse.ok) {
        console.error("❌ Erreur envoi mail");
        return {
          statusCode: 500,
          body: resendData,
        };
      }

      console.log("✅ Email envoyé !");
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
