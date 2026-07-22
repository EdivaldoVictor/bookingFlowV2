import { MercadoPagoConfig, Payment } from "mercadopago";

// Inicializa o cliente do Mercado Pago usando a variável de ambiente
const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN!,
});

// Inicializa a classe Payment usando o cliente configurado
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
  const expirationDate = new Date();
  expirationDate.setMinutes(expirationDate.getMinutes() + 30);

  const result = await payment.create({
    body: {
      transaction_amount: Number(amount.toFixed(2)),
      description: `Agendamento - Reserva ${bookingId}`,
      payment_method_id: "pix",
      date_of_expiration: expirationDate.toISOString(),
      payer: {
        email: email,
        first_name: name,
      },
      notification_url: `${process.env.BASE_URL}/api/webhooks/mercadopago`, 
    },
  });

  const qrCode = result.point_of_interaction?.transaction_data?.qr_code;
  const qrCodeBase64 = result.point_of_interaction?.transaction_data?.qr_code_base64;

  if (!qrCode || !qrCodeBase64) {
    throw new Error("Mercado Pago não retornou os dados do Pix corretamente.");
  }

  return {
    paymentId: result.id,
    qrCodeBase64: qrCodeBase64,
    qrCode: qrCode,
  };
}