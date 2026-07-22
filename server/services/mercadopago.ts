import mercadopago from 'mercadopago';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { db } from '../db';

mercadopago.configure({
  access_token: process.env.MP_ACCESS_TOKEN!,
});

export const mercadopagoService = {
  async createPIXPreference(bookingData: {
    bookingId: string;
    amount: number;
    practitionerName: string;
    customerEmail: string;
    customerName: string;
  }) {
    try {
      const preference = {
        items: [
          {
            title: `Consulta com ${bookingData.practitionerName}`,
            quantity: 1,
            unit_price: bookingData.amount,
            currency_id: 'BRL',
          },
        ],
        payer: {
          email: bookingData.customerEmail,
          name: bookingData.customerName,
        },
        external_reference: bookingData.bookingId,
        notification_url: `${process.env.BASE_URL}/api/webhook/mercadopago`,
        back_urls: {
          success: `${process.env.BASE_URL}/booking/success?bookingId=${bookingData.bookingId}`,
          failure: `${process.env.BASE_URL}/booking/error`,
          pending: `${process.env.BASE_URL}/booking/pending`,
        },
        auto_return: 'approved',
        payment_methods: {
          excluded_payment_types: [{ id: 'credit_card' }, { id: 'debit_card' }],
        },
      };

      const response = await mercadopago.preferences.create(preference);

      // Salvar o payment_id/preference_id no banco
      await db
        .update('bookings')
        .set({
          paymentProvider: 'mercadopago',
          paymentId: response.body.id,
          status: 'pending',
        })
        .where('id', bookingData.bookingId);

      return {
        preferenceId: response.body.id,
        init_point: response.body.init_point, // link de pagamento
        qrCode: response.body.point_of_interaction?.transaction_data?.qr_code,
        qrCodeBase64: response.body.point_of_interaction?.transaction_data?.qr_code_base64,
      };
    } catch (error: any) {
      console.error('Mercado Pago Error:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Erro ao criar pagamento PIX',
      });
    }
  },

  async handleWebhook(notification: any) {
    // Validar e processar webhook
    if (notification.type === 'payment') {
      const payment = await mercadopago.payment.findById(notification.data.id);

      if (payment.body.status === 'approved') {
        const bookingId = payment.body.external_reference;

        await db
          .update('bookings')
          .set({
            status: 'confirmed',
            paidAt: new Date(),
          })
          .where('id', bookingId);

        // Criar evento no Cal.com (reutilizar lógica que você já tem no Stripe)
        await createCalComEvent(bookingId);
      }
    }
  },
};