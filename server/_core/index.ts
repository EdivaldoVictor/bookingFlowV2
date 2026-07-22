import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerWebhookRoutes } from "./webhooks";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { MercadoPagoConfig, Payment } from "mercadopago";
import { updateBookingStatus, getBooking, getPractitioner } from "../db";
import { createCalComBooking } from "../services/availability";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Seed practitioners (and admin) on boot — schema setup is manual via `pnpm db:reset`.
  try {
    console.log("[Server] Seeding database if needed...");
    const { seedDatabase } = await import("../../scripts/db.ts");
    await seedDatabase();
  } catch (error) {
    console.log(
      "[Server] Database seed completed (may have failed, but continuing):",
      error instanceof Error ? error.message : error
    );
  }

  // Webhook handlers (must be registered BEFORE body parser to handle raw body for Stripe)
  registerWebhookRoutes(app);

  // Configure body parser with larger size limit for file uploads (and for parsing standard JSON like Mercado Pago)
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // =====================================================================
  // WEBHOOK MERCADO PAGO (Pix)
  // =====================================================================
  app.post("/api/webhooks/mercadopago", async (req, res) => {
    const { type, data } = req.body;

    if (type === "payment" && data?.id) {
      try {
        // Inicializa o Mercado Pago para buscar os dados reais do pagamento
        // (Isso evita que alguém forje um webhook falso)
        const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN! });
        const payment = new Payment(client);
        const paymentInfo = await payment.get({ id: data.id });

        if (paymentInfo.status === "approved") {
          // Extrai o ID do agendamento da descrição (ex: "Agendamento - Reserva 123")
          const description = paymentInfo.description || "";
          const match = description.match(/Reserva ([\w-]+)/);
          const bookingId = match ? match[1] : null;

          if (bookingId) {
            console.log(`[MercadoPago] Pagamento aprovado para a reserva ${bookingId}`);

            // 1. Atualiza o banco de dados
            await updateBookingStatus(bookingId, "confirmed");

            // 2. Busca dados da reserva para criar o evento no Cal.com
            const booking = await getBooking(bookingId);
            if (booking) {
              const practitioner = await getPractitioner(booking.practitionerId);
              
              if (practitioner) {
                // Calcula o horário de término (padrão de 1 hora, igual ao Stripe)
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
                  console.log(`[MercadoPago] Cal.com event created: ${calComResult.eventId}`);
                } else {
                  console.warn(`[MercadoPago] Failed to create Cal.com event: ${calComResult.error}`);
                }
              }
            }
          }
        }
      } catch (error) {
        console.error("[MercadoPago] Erro ao processar webhook:", error);
      }
    }

    // Retorna 200 rapidamente para o Mercado Pago não tentar reenviar
    res.status(200).send("OK");
  });
  // =====================================================================

  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);

  // tRPC API - must be registered BEFORE Vite setup
  console.log("[Server] Registering tRPC routes...");
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  console.log("[Server] tRPC routes registered successfully");

  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);