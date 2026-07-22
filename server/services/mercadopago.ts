/**
 * Mercado Pago service for PIX payments
 * Real integration with Mercado Pago API
 */

import mercadopago from 'mercadopago';
import { TRPCError } from '@trpc/server';

export interface PixResponse {
  id: string;
  qrCode: string;
  qrCodeBase64: string;
  bookingId: string;
}

// Configuração
const getMercadoPagoClient = () => {
  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error("MP_ACCESS_TOKEN is not set in environment variables");
  }

  mercadopago.configure({
    access_token: accessToken,
  });

  return mercadopago;
};

export async function createPIXPayment(params: {
  amount: number;
  bookingId: string;
  clientEmail: string;
  clientName: string;
  practitionerName: string;
  serviceName?: string;
}): Promise<PixResponse> {
  try {
    const mp = getMercadoPagoClient();

    const preference = {
      items: [
        {
          title: params.serviceName || `Corte de cabelo com ${params.practitionerName}`,
          quantity: 1,
          unit_price: params.amount,
          currency_id: "BRL",
          description: `Agendamento para ${params.clientName}`,
        },
      ],
      payer: {
        email: params.clientEmail,
        name: params.clientName,
      },
      external_reference: params.bookingId,
      notification_url: `${process.env.BASE_URL}/api/webhook/mercadopago`,
      back_urls: {
        success: `${process.env.BASE_URL}/booking/success?bookingId=${params.bookingId}&provider=mercadopago`,
        failure: `${process.env.BASE_URL}/booking/error`,
        pending: `${process.env.BASE_URL}/booking/pending?bookingId=${params.bookingId}`,
      },
      auto_return: "approved",
      payment_methods: {
        excluded_payment_types: [
          { id: "credit_card" },
          { id: "debit_card" },
          { id: "ticket" }, // remove boleto se quiser só PIX
        ],
      },
      statement_descriptor: "BOOKINGFLOW",
    };

    const response = await mp.preferences.create(preference);

    const transactionData = response.body.point_of_interaction?.transaction_data;

    // Atualizar booking no banco (recomendo criar uma função compartilhada)
    // await updateBookingPaymentInfo(params.bookingId, 'mercadopago', response.body.id);

    return {
      preferenceId: response.body.id,
      initPoint: response.body.init_point,
      qrCode: transactionData?.qr_code || null,
      qrCodeBase64: transactionData?.qr_code_base64 || null,
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

    const mp = getMercadoPagoClient();
    const payment = await mp.payment.findById(notification.data.id);

    const paymentData = payment.body;

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