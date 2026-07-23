/**
 * Mercado Pago service for PIX payments
 * Integrado com o webhook.ts
 */

import { MercadoPagoConfig, Payment } from "mercadopago";
import { TRPCError } from '@trpc/server';

export interface PixResponse {
  id: string;
  qrCode: string;
  qrCodeCopyPaste: string;
  qrCodeBase64: string;
  bookingId: string;
}

const getMercadoPagoClient = () => {
  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error("MP_ACCESS_TOKEN is not set in environment variables");
  }
  return new MercadoPagoConfig({ accessToken });
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
    const paymentClient = new Payment(getMercadoPagoClient());

    const payment = await paymentClient.create({
      body: {
        transaction_amount: Number(params.amount),
        payment_method_id: "pix",
        payer: {
          email: params.clientEmail,
          first_name: params.clientName,
        },
        external_reference: params.bookingId,
        notification_url: `${process.env.BASE_URL}/api/webhooks/mercadopago`,
        description: params.serviceName || `Agendamento com ${params.practitionerName}`,
      },
    });

    const transactionData = payment.point_of_interaction?.transaction_data;

    if (!transactionData?.qr_code) {
      console.error(
        "[Mercado Pago Error] Missing qr_code in payment response:",
        JSON.stringify(payment, null, 2)
      );
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Não foi possível gerar o código PIX",
      });
    }

    return {
      id: String(payment.id),
      qrCode: transactionData.qr_code,
      qrCodeCopyPaste: transactionData.qr_code,
      qrCodeBase64: transactionData.qr_code_base64 || "",
      bookingId: params.bookingId,
    };
  } catch (error: any) {
    const message = error?.response?.data?.message || error.message || error;
    console.error("[Mercado Pago Error]:", message);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Erro ao gerar pagamento PIX",
      cause: error,
    });
  }
}

export async function processMercadoPagoWebhook(notification: any) {
  try {
    if (notification.type !== "payment") return null;

    const paymentClient = new Payment(getMercadoPagoClient());
    const paymentData = await paymentClient.get({ id: notification.data.id });

    if (paymentData.status === "approved" && paymentData.external_reference) {
      const bookingId = paymentData.external_reference;
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