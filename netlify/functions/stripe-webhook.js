import Stripe from "stripe";

export default async (req) => {
  return new Response("Webhook OK", { status: 200 });
};

export const config = {
  path: "/.netlify/functions/stripe-webhook"
};
