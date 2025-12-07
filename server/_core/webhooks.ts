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
  getPractitioner,
} from "../db";
import { createCalComBooking } from "../services/availability";

/**
 * Register webhook routes
 */
export function registerWebhookRoutes(app: Express) {
  // Stripe webhook endpoint
  // Note: This must use raw body parser, not JSON parser
  // The raw body is required for signature verification
  app.post(
    "/api/webhooks/stripe",
    express.raw({ type: "application/json" }),
    handleStripeWebhook
  );

  console.log("[Webhook] Stripe webhook endpoint registered at /api/webhooks/stripe");
}

/**
 * Handle Stripe webhook events
 */
async function handleStripeWebhook(req: Request, res: Response) {
  console.log("[Webhook] Received request at /api/webhooks/stripe");
  
  const signature = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || typeof signature !== "string") {
    console.error("[Webhook] Missing stripe-signature header");
    console.error("[Webhook] Headers received:", Object.keys(req.headers));
    return res.status(400).json({ error: "Missing signature" });
  }

  if (!webhookSecret) {
    console.error("[Webhook] STRIPE_WEBHOOK_SECRET not configured");
    console.error("[Webhook] Please run 'stripe listen' and add the webhook secret to .env");
    return res.status(500).json({ error: "Webhook secret not configured" });
  }

  console.log("[Webhook] Webhook secret configured, signature present");

  let event: any = null;
  try {
    // Validate webhook signature and construct event
    event = validateWebhookSignature(req.body, signature, webhookSecret);

    console.log(`[Webhook] Received event: ${event.type}`);

    // Process the webhook event
    const result = await processWebhookEvent(event);

    if (result) {
      const { bookingId, sessionId } = result;

      console.log(`[Webhook] Processing payment for booking ${bookingId}, session ${sessionId}`);

      // Get the booking to retrieve payment intent ID
      const booking = await getBooking(bookingId);
      if (!booking) {
        console.error(`[Webhook] Booking ${bookingId} not found`);
        return res.status(404).json({ error: "Booking not found" });
      }

      console.log(`[Webhook] Booking ${bookingId} found: ${booking.clientName} (${booking.clientEmail})`);

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

      // Create Cal.com event automatically
      try {
        const practitioner = await getPractitioner(booking.practitionerId);
        if (practitioner) {
          // Calculate end time (assuming 1 hour sessions)
          const endTime = new Date(booking.bookingTime);
          endTime.setHours(endTime.getHours() + 1);

          const calComResult = await createCalComBooking({
            practitionerId: booking.practitionerId,
            clientName: booking.clientName,
            clientEmail: booking.clientEmail,
            clientPhone: booking.clientPhone,
            startTime: booking.bookingTime,
            endTime: endTime,
            title: `Consultation with ${practitioner.name}`,
          });
          
          if (calComResult.success) {
            console.log(`[Webhook] Cal.com event created: ${calComResult.eventId}`);
          } else {
            console.warn(`[Webhook] Failed to create Cal.com event: ${calComResult.error}`);
          }
        }
      } catch (error) {
        console.error("[Webhook] Error creating Cal.com event:", error);
        // Don't fail the webhook if Cal.com fails - booking is already confirmed
      }

      // TODO: Send confirmation email to client
      // TODO: Send notification to practitioner
    }

    // Return 200 to acknowledge receipt
    if (event) {
      console.log(`[Webhook] Webhook processed successfully for event: ${event.type}`);
    } else {
      console.log(`[Webhook] Webhook processed successfully (no event processed)`);
    }
    return res.json({ received: true });
  } catch (error) {
    console.error("[Webhook] Error processing webhook:", error);
    console.error("[Webhook] Event type:", event?.type || "unknown");
    console.error("[Webhook] Error details:", error instanceof Error ? error.stack : error);
    return res.status(400).json({
      error:
        error instanceof Error ? error.message : "Webhook processing failed",
    });
  }
}

// Re-export express for use in the handler
import express from "express";
