/**
 * Webhook handlers for external services (Stripe + Mercado Pago)
 */

import { Express, Request, Response } from "express";
import {
  validateWebhookSignature,
  processWebhookEvent,
} from "../services/stripe";

import {
  processMercadoPagoWebhook,
} from "../services/mercadopago";

import {
  updateBookingStatus,
  updateBookingWithStripeData,   // Podemos criar um update genérico depois
  getBooking,
  getPractitioner,
} from "../db";
import { createCalComBooking } from "../services/availability";
import express from "express";

/**
 * Register webhook routes
 */
export function registerWebhookRoutes(app: Express) {
  // Stripe webhook
  app.post(
    "/api/webhooks/stripe",
    express.raw({ type: "application/json" }),
    handleStripeWebhook
  );

  // Mercado Pago webhook
  app.post(
    "/api/webhooks/mercadopago",
    express.raw({ type: "application/json" }),
    handleMercadoPagoWebhook
  );

  console.log("[Webhook] Stripe webhook registered at /api/webhooks/stripe");
  console.log("[Webhook] Mercado Pago webhook registered at /api/webhooks/mercadopago");
}

/* ==================== STRIPE WEBHOOK ==================== */
async function handleStripeWebhook(req: Request, res: Response) {
  // ... (seu código atual do Stripe permanece igual)
  // Vou manter o seu código original aqui para não quebrar nada
  console.log("[Webhook] Received request at /api/webhooks/stripe");
  
  const signature = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || typeof signature !== "string") {
    return res.status(400).json({ error: "Missing signature" });
  }

  if (!webhookSecret) {
    return res.status(500).json({ error: "Webhook secret not configured" });
  }

  let event: any = null;
  try {
    event = validateWebhookSignature(req.body, signature, webhookSecret);
    const result = await processWebhookEvent(event);

    if (result) {
      await confirmBookingAndCreateCalEvent(result.bookingId, "stripe");
    }

    return res.json({ received: true });
  } catch (error) {
    console.error("[Stripe Webhook] Error:", error);
    return res.status(400).json({ error: "Webhook processing failed" });
  }
}

/* ==================== MERCADO PAGO WEBHOOK ==================== */
async function handleMercadoPagoWebhook(req: Request, res: Response) {
  console.log("[Webhook] Received request at /api/webhooks/mercadopago");

  try {
    const notification = req.body;

    console.log(`[Mercado Pago] Notification received:`, {
      type: notification.type,
      id: notification.data?.id
    });

    const result = await processMercadoPagoWebhook(notification);

    if (result?.bookingId) {
      console.log(`[Mercado Pago] Processing approved payment for booking ${result.bookingId}`);
      
      await confirmBookingAndCreateCalEvent(result.bookingId, "mercadopago");
    }

    // Sempre retornar 200 para o Mercado Pago
    return res.status(200).json({ received: true });
  } catch (error) {
    console.error("[Mercado Pago Webhook] Error:", error);
    // Ainda retornar 200 para não bloquear o webhook do MP
    return res.status(200).json({ received: true });
  }
}

/**
 * Função compartilhada para confirmar booking + criar evento no Cal.com
 */
async function confirmBookingAndCreateCalEvent(bookingId: string, provider: 'stripe' | 'mercadopago') {
  try {
    const booking = await getBooking(bookingId);
    if (!booking) {
      console.error(`[Webhook] Booking ${bookingId} not found`);
      return;
    }

    // Atualiza status
    await updateBookingStatus(bookingId, "confirmed");

    console.log(`[Webhook] Booking ${bookingId} confirmed via ${provider}`);

    // Cria evento no Cal.com
    const practitioner = await getPractitioner(booking.practitionerId);
    
    if (practitioner) {
      const endTime = new Date(booking.bookingTime);
      endTime.setHours(endTime.getHours() + 1);

      const calComResult = await createCalComBooking({
        practitionerId: booking.practitionerId,
        clientName: booking.clientName,
        clientEmail: booking.clientEmail,
        clientPhone: booking.clientPhone || "",
        startTime: booking.bookingTime,
        endTime: endTime,
        title: `Consulta com ${practitioner.name}`,
      });

      if (calComResult.success) {
        console.log(`✅ Cal.com event created: ${calComResult.eventId}`);
      } else {
        console.warn(`⚠️ Cal.com event creation failed: ${calComResult.error}`);
      }
    }
  } catch (error) {
    console.error(`[Webhook] Error confirming booking ${bookingId}:`, error);
  }
}