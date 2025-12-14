/**
 * Stripe service for payment processing
 * Real integration with Stripe API
 */

import Stripe from "stripe";

export interface CheckoutSession {
  id: string;
  url: string;
  amount: number;
  currency: string;
  status: "open" | "complete" | "expired";
}

export interface WebhookEvent {
  id: string;
  type: string;
  data: {
    object: {
      id: string;
      status: string;
      amount: number;
      metadata?: Record<string, string>;
    };
  };
}

// Initialize Stripe with API key from environment
const getStripeClient = () => {
  const apiKey = process.env.STRIPE_SECRET_KEY;
  if (!apiKey) {
    throw new Error("STRIPE_SECRET_KEY is not set in environment variables");
  }
  return new Stripe(apiKey, {
    apiVersion: "2025-02-24.acacia",
  });
};

/**
 * Create a real Stripe checkout session
 * Returns a checkout URL for the customer to complete payment
 */
export async function createCheckoutSession(params: {
  amount: number;
  currency: string;
  clientEmail: string;
  clientName: string;
  bookingId: string;
}): Promise<CheckoutSession> {
  const stripe = getStripeClient();

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    expires_at: Math.floor(Date.now() / 1000) + 1800,
       line_items: [
      {
        price_data: {
          currency: params.currency.toLowerCase(),
          product_data: {
            name: "Practitioner Booking",
            description: `Booking for ${params.clientName}`,
          },
          unit_amount: params.amount, // Amount in pence/cents
        },
        quantity: 1,
      },
    ],
    mode: "payment",
    customer_email: params.clientEmail,
    client_reference_id: params.bookingId,
    metadata: {
      bookingId: params.bookingId,
      clientName: params.clientName,
    },
    success_url: `${process.env.BASE_URL || "http://localhost:3000"}/booking/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.BASE_URL || "http://localhost:3000"}`,
  },
);

  if (!session.url) {
    throw new Error("Failed to create checkout session URL");
  }

  return {
    id: session.id,
    url: session.url,
    amount: params.amount,
    currency: params.currency,
    status:
      session.status === "open"
        ? "open"
        : session.status === "complete"
          ? "complete"
          : "expired",
  };
}

/**
 * Retrieve a checkout session by ID
 */
export async function getCheckoutSession(
  sessionId: string
): Promise<Stripe.Checkout.Session> {
  const stripe = getStripeClient();
  return await stripe.checkout.sessions.retrieve(sessionId);
}

/**
 * Validate webhook signature from Stripe
 * This ensures the webhook request actually came from Stripe
 */
export function validateWebhookSignature(
  payload: string | Buffer,
  signature: string,
  webhookSecret: string
): Stripe.Event {
  const stripe = getStripeClient();

  try {
    return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (error) {
    throw new Error(
      `Webhook signature verification failed: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Process webhook event from Stripe
 * Returns the booking ID if the payment was successful
 */
export async function processWebhookEvent(
  event: Stripe.Event
): Promise<{ bookingId: string; sessionId: string } | null> {
  // Handle the checkout.session.completed event
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    if (session.payment_status === "paid" && session.metadata?.bookingId) {
      return {
        bookingId: session.metadata.bookingId,
        sessionId: session.id,
      };
    }
  }

  return null;
}

/**
 * Create a refund for a payment
 */
export async function createRefund(
  paymentIntentId: string,
  amount?: number
): Promise<Stripe.Refund> {
  const stripe = getStripeClient();

  return await stripe.refunds.create({
    payment_intent: paymentIntentId,
    amount: amount, // Optional: partial refund amount in pence/cents
  });
}
