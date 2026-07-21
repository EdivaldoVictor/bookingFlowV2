import { MercadoPagoConfig, Payment } from "mercadopago";

// Inicializa o cliente do Mercado Pago usando a variável de ambiente
const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN!,
});

const payment = new Payment(client);

// Função exportada para ser usada dentro de server/routers.ts
export async function createPixPayment({
  amount,
  email,
  name,
  bookingId 
}: {
  amount: number;
  email: string;
  name: string;
  bookingId: string;
}) {
  const result = await payment.create({
    body: {
      transaction_amount: amount,
      description: `Agendamento - Reserva ${bookingId}`,
      payment_method_id: "pix",
      payer: {
        email: email,
        first_name: name,
      },
      // URL para onde o Mercado Pago enviará o aviso de pagamento pago
      notification_url: `${process.env.BASE_URL}/api/webhooks/mercadopago`, 
    },
  });

  // Retorna apenas o que o Frontend precisa para renderizar a tela do Pix
  return {
    paymentId: result.id,
    qrCodeBase64: result.point_of_interaction?.transaction_data?.qr_code_base64,
    qrCodeCopyPaste: result.point_of_interaction?.transaction_data?.qr_code,
  };
}