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
  // Define a data de expiração para daqui a 30 minutos (obrigatório para alguns cenários do Pix)
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
        // O Mercado Pago em ambiente de teste às vezes exige identificação ou CPF genérico se validado estritamente, 
        // mas o email e o nome já ajudam muito.
      },
      notification_url: `${process.env.BASE_URL}/api/webhooks/mercadopago`, 
    },
  });

  // Validação de segurança para garantir que os dados vieram preenchidos
  const qrCode = result.point_of_interaction?.transaction_data?.qr_code;
  const qrCodeBase64 = result.point_of_interaction?.transaction_data?.qr_code_base64;

  if (!qrCode || !qrCodeBase64) {
    throw new Error("Mercado Pago não retornou os dados do Pix corretamente.");
  }

  return {
    paymentId: result.id,
    qrCodeBase64: qrCodeBase64,
    qrCode: qrCode, // Mapeado diretamente para o front-end
  };
}