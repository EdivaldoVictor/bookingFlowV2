/**
 * Mercado Pago service for PIX payments
 * Integrado com o webhook.ts
 */

import { MercadoPagoConfig, Preference, Payment } from "mercadopago";
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

/**
 * Cria pagamento PIX usando Preference (recomendado)
 */
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
    const preferenceClient = new Preference(getMercadoPagoClient());

    const preference = await preferenceClient.create({
      body: {
        items: [
          {
            id: "1",
            title: params.serviceName || `Agendamento com ${params.practitionerName}`,
            quantity: 1,
            unit_price: Number(params.amount),
            currency_id: "BRL",
          },
        ],
        payer: {
          email: params.clientEmail,
          name: params.clientName,
        },
        external_reference: params.bookingId,
        notification_url: `${process.env.BASE_URL}/api/webhooks/mercadopago`,
        back_urls: {
          success: `${process.env.BASE_URL}/booking/success?provider=mercadopago&bookingId=${params.bookingId}`,
          pending: `${process.env.BASE_URL}/booking/pending?bookingId=${params.bookingId}`,
          failure: `${process.env.BASE_URL}/booking/error`,
        },
        auto_return: "approved",
        binary_mode: false,
      },
    });

    const transactionData = (preference as any).point_of_interaction?.transaction_data;

    if (!transactionData?.qr_code) {
      console.error(
        "[Mercado Pago Error] Missing qr_code in preference response:",
        JSON.stringify(preference, null, 2)
      );
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Não foi possível gerar o código PIX",
      });
    }

    return {
      id: preference.id || "",
      qrCode: transactionData.qr_code,
      qrCodeCopyPaste: transactionData.qr_code,
      qrCodeBase64: transactionData.qr_code_base64 || "",
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
 * Totalmente integrado com a lógica do webhook.ts
 */
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