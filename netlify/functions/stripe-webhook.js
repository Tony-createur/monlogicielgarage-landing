const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 200,
        body: "Webhook OK",
      };
    }

    const sig = event.headers["stripe-signature"];

    const stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    if (stripeEvent.type === "checkout.session.completed") {
      const session = stripeEvent.data.object;

      console.log("✅ Paiement réussi :", session.id);

      // 👉 Ici tu pourras ajouter :
      // - création utilisateur
      // - envoi email
      // - accès sécurisé
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ received: true }),
    };
  } catch (err) {
    console.error("❌ Webhook error:", err.message);

    return {
      statusCode: 400,
      body: `Webhook Error: ${err.message}`,
    };
  }
};
