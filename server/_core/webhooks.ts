/**
 * Webhook handlers for external services
 */

import { Express, Request, Response } from "express";
import {
  validateWebhookSignature,
  processWebhookEvent,
} from "../services/stripe";
import {
  updateBookingStatus,
  updateBookingWithStripeData,
  getBooking,
} from "../db";

/**
 * Register webhook routes
 */
export function registerWebhookRoutes(app: Express) {
  // Stripe webhook endpoint
  // Note: This must use raw body parser, not JSON parser
  app.post(
    "/api/webhooks/stripe",
    express.raw({ type: "application/json" }),
    handleStripeWebhook
  );
}

/**
 * Handle Stripe webhook events
 */
async function handleStripeWebhook(req: Request, res: Response) {
  const signature = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || typeof signature !== "string") {
    console.error("[Webhook] Missing stripe-signature header");
    return res.status(400).json({ error: "Missing signature" });
  }

  if (!webhookSecret) {
    console.error("[Webhook] STRIPE_WEBHOOK_SECRET not configured");
    return res.status(500).json({ error: "Webhook secret not configured" });
  }

  try {
    // Validate webhook signature and construct event
    const event = validateWebhookSignature(req.body, signature, webhookSecret);

    console.log(`[Webhook] Received event: ${event.type}`);

    // Process the webhook event
    const result = await processWebhookEvent(event);

    if (result) {
      const { bookingId, sessionId } = result;

      // Get the booking to retrieve payment intent ID
      const booking = await getBooking(bookingId);
      if (!booking) {
        console.error(`[Webhook] Booking ${bookingId} not found`);
        return res.status(404).json({ error: "Booking not found" });
      }

      // Get payment intent ID from the session
      const session = event.data.object as any;
      const paymentIntentId = session.payment_intent || "";

      // Update booking with payment intent ID if not already set
      if (paymentIntentId && !booking.stripePaymentIntentId) {
        await updateBookingWithStripeData(
          bookingId,
          sessionId,
          paymentIntentId
        );
      }

      // Confirm the booking
      await updateBookingStatus(bookingId, "confirmed");

      console.log(`[Webhook] Booking ${bookingId} confirmed successfully`);

      // TODO: Send confirmation email to client
      // TODO: Create Cal.com booking
      // TODO: Send notification to practitioner
    }

    // Return 200 to acknowledge receipt
    return res.json({ received: true });
  } catch (error) {
    console.error("[Webhook] Error processing webhook:", error);
    return res.status(400).json({
      error:
        error instanceof Error ? error.message : "Webhook processing failed",
    });
  }
}

// Re-export express for use in the handler
import express from "express";
