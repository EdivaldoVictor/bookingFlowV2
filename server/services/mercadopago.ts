/**
 * Mercado Pago service for PIX payments
 * Real integration with Mercado Pago API
 */

import { MercadoPagoConfig, Payment } from "mercadopago";
import { TRPCError } from '@trpc/server';

export interface PixResponse {
  id: string;
  qrCode: string;
  qrCodeBase64: string;
  bookingId: string;
}

const getMercadoPagoClient = () => {
  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error("MP_ACCESS_TOKEN is not set in environment variables");
  }

  const client = new MercadoPagoConfig({ accessToken });
  return new Payment(client);
};

export async function createPixPayment(params: {
  amount: number;
  bookingId: string;
  clientEmail: string;
  clientName: string;
  practitionerName: string;
  serviceName?: string;
}): Promise<PixResponse> {
  if (!Number.isFinite(params.amount) || params.amount <= 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Invalid payment amount: ${params.amount}`,
    });
  }

  try {
    const paymentData = {
      transaction_amount: params.amount,
      payment_method_id: "pix",
      description: params.serviceName || `Corte de cabelo com ${params.practitionerName}`,
      external_reference: params.bookingId,
      notification_url: `${process.env.BASE_URL}/api/webhook/mercadopago`,
      payer: {
        email: params.clientEmail,
        first_name: params.clientName,
      },
    };

    const payment = await getMercadoPagoClient().create({ body: paymentData });
    const qrCodeData = payment.point_of_interaction?.transaction_data;

    return {
      id: payment.id.toString(),
      qrCode: qrCodeData?.qr_code || "",
      qrCodeBase64: qrCodeData?.qr_code_base64 || "",
      bookingId: params.bookingId,
    };
  } catch (error: any) {
    console.error("[Mercado Pago Error]:", error.message || error);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Erro ao gerar pagamento PIX",
      cause: error,
    });
  }
}

/**
 * Processa webhook do Mercado Pago
 */
export async function processMercadoPagoWebhook(notification: any) {
  try {
    if (notification.type !== "payment") return null;

    const paymentData = await getMercadoPagoClient().get({ id: notification.data.id });

    if (paymentData.status === "approved" && paymentData.external_reference) {
      const bookingId = paymentData.external_reference;

      // Aqui você deve chamar a mesma lógica que usa no Stripe para confirmar booking + criar evento no Cal.com
      // Ex: await confirmBookingAndCreateEvent(bookingId);

      console.log(`✅ Pagamento PIX aprovado! Booking: ${bookingId}`);

      return {
        bookingId,
        paymentId: paymentData.id,
        status: paymentData.status,
      };
    }

    return null;
  } catch (error) {
    console.error("[Mercado Pago Webhook Error]:", error);
    return null;
  }
}