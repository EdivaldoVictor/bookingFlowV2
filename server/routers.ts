import { COOKIE_NAME } from "@shared/const";
import { eq } from "drizzle-orm";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { createPixPayment } from "./services/mercadopago";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import {
  getPractitioner,
  createBooking,
  getBooking,
  getBookingByStripeSessionId,
  updateBookingStatus,
  checkBookingConflict,
  updateBookingWithStripeData,
  getDb,
} from "./db";
import { bookings, practitioners, users } from "../drizzle/schema";
import { createCalComBooking, cancelCalComBooking } from "./services/availability";
import { getAvailabilityForPractitioner } from "./services/availability";
import { createCheckoutSession, createRefund } from "./services/stripe";

export const appRouter = router({
  // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,

  // Practitioners endpoint
  practitioners: router({
    getAll: publicProcedure.query(async () => {
      console.log(`[Router] getAllPractitioners called`);

      const db = await getDb();
      if (!db) {
        console.error(`[Router] Database not available`);
        throw new Error("Database not available");
      }

      try {
        const result = await db.select().from(practitioners);
        console.log(`[Router] Found ${result.length} practitioners in database`);
        return result;
      } catch (error) {
        throw new Error("Error fetching practitioners");
      }
    }),
  }),

  auth: router({
    me: publicProcedure.query((opts) => {
      if (!opts.ctx.user) return null;
      const { toPublicUser } = require("./_core/publicUser") as typeof import("./_core/publicUser");
      return toPublicUser(opts.ctx.user);
    }),
    register: publicProcedure
      .input(
        z.object({
          name: z.string().min(2),
          email: z.string().email(),
          password: z.string().min(6),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const normalizedEmail = input.email.trim().toLowerCase();
        const existing = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1);
        if (existing.length > 0) {
          throw new Error("Email already registered");
        }

        const { resolveUserRole } = await import("./_core/roles");
        const { hashPassword } = await import("./_core/password");
        const role = resolveUserRole({ email: normalizedEmail, openId: `local:${normalizedEmail}` });
        const passwordHash = await hashPassword(input.password);

        const openId = `local:${normalizedEmail}`;
        const { upsertUser } = await import("./db");
        await upsertUser({
          openId,
          name: input.name,
          email: normalizedEmail,
          passwordHash,
          loginMethod: "local",
          role,
          lastSignedIn: new Date(),
        });

        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(
          COOKIE_NAME,
          await import("./_core/sdk").then((m) =>
            m.sdk.createSessionToken(openId, { name: input.name, expiresInMs: 31536000000 })
          ),
          {
            ...cookieOptions,
            maxAge: 31536000000,
          }
        );

        return { success: true, user: { openId, name: input.name, email: normalizedEmail, role } };
      }),
    login: publicProcedure
      .input(
        z.object({
          email: z.string().email(),
          password: z.string().min(6),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        const normalizedEmail = input.email.trim().toLowerCase();
        const usersResult = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1);
        const userRecord = usersResult[0];

        const { verifyPassword } = await import("./_core/password");
        const passwordOk =
          Boolean(userRecord) && (await verifyPassword(input.password, userRecord.passwordHash));

        if (!userRecord || !passwordOk) {
          throw new Error("Invalid credentials");
        }

        const { resolveUserRole } = await import("./_core/roles");
        const role = resolveUserRole(userRecord);

        // Keep DB role in sync with ADMIN_EMAILS on every login.
        if (userRecord.role !== role) {
          const { upsertUser } = await import("./db");
          await upsertUser({
            openId: userRecord.openId,
            email: userRecord.email,
            role,
            lastSignedIn: new Date(),
          });
        }

        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(
          COOKIE_NAME,
          await import("./_core/sdk").then((m) =>
            m.sdk.createSessionToken(userRecord.openId, {
              name: userRecord.name || "",
              expiresInMs: 31536000000,
            })
          ),
          {
            ...cookieOptions,
            maxAge: 31536000000,
          }
        );

        return {
          success: true,
          user: {
            openId: userRecord.openId,
            name: userRecord.name,
            email: userRecord.email,
            role,
          },
        };
      }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // Booking system routers
  bookings: router({
    /**
     * Get availability for a practitioner
     * Returns time slots for the next 7-14 days
     */
    getAvailability: publicProcedure
      .input(z.object({ practitionerId: z.string().uuid() }))
      .query(async ({ input }) => {
        console.log(`[Router] getAvailability called with practitionerId: ${input.practitionerId}`);

        const practitioner = await getPractitioner(input.practitionerId);
        console.log(`[Router] Practitioner found:`, practitioner);

        if (!practitioner) {
          throw new Error("Practitioner not found");
        }

        console.log(`[Router] Calling getAvailabilityForPractitioner...`);
        const slots = await getAvailabilityForPractitioner(practitioner.id);
        console.log(`[Router] Got ${slots.length} slots from availability service`);

        const availableSlots = slots.filter((s) => s.available);
        console.log(`[Router] Filtered to ${availableSlots.length} available slots`);

        return {
          practitioner,
          slots: availableSlots,
        };
      }),

    /**
     * Create a new booking with Pix payment
     */
    createPixBooking: publicProcedure
      .input(
        z.object({
          practitionerId: z.string().uuid(),
          clientName: z.string().min(1),
          clientEmail: z.string().email(),
          clientPhone: z.string().min(1),
          bookingTime: z.string().datetime(),
          servicePrice: z.number().nonNegative().optional(),
          serviceName: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        console.log(`[PixBooking] Starting Pix booking creation for practitioner ${input.practitionerId}`);
        
        const practitioner = await getPractitioner(input.practitionerId);
        if (!practitioner) throw new Error("Practitioner not found");

        const bookingTime = new Date(input.bookingTime);
        const existingBooking = await checkBookingConflict(practitioner.id, bookingTime);
        
        if (existingBooking) {
          throw new Error("This time slot is already booked. Please select another time.");
        }

        const selectedServicePrice = Number(input.servicePrice ?? 25);
        const selectedServiceName = input.serviceName ?? "Cabelo";

        // 1. Criar o agendamento no banco de dados com status 'pending_pix'
        const bookingData = {
          practitionerId: practitioner.id,
          clientName: input.clientName,
          clientEmail: input.clientEmail,
          clientPhone: input.clientPhone,
          bookingTime: bookingTime,
          status: "pending" as const, // Salvamos como pending, será atualizado pelo webhook do MP
          amount: Math.round(selectedServicePrice * 100), // Salva no banco em centavos
          stripeSessionId: null,
          stripePaymentIntentId: null,
        };

        const booking = await createBooking(bookingData);
        if (!booking || !booking.id) throw new Error("Failed to create booking");

        // 2. Chamar o serviço do Mercado Pago (passa o valor normal, não em centavos)
        const pixData = await createPixPayment({
          amount: selectedServicePrice,
          clientEmail: input.clientEmail,
          clientName: input.clientName,
          bookingId: String(booking.id),
          practitionerName: practitioner.name,
          serviceName: selectedServiceName,
        });

        // 3. Retornar os dados do QR Code para o frontend
        return {
          bookingId: booking.id,
          ...pixData,
        };
      }),

    /**
     * Create a new booking and generate Stripe checkout session
     */
    createBooking: publicProcedure
      .input(
        z.object({
          practitionerId: z.string().uuid(),
          clientName: z.string().min(1),
          clientEmail: z.string().email(),
          clientPhone: z.string().min(1),
          bookingTime: z.string().datetime(),
          serviceId: z.string().optional(),
          serviceName: z.string().optional(),
          servicePrice: z.number().optional(),
          serviceDurationMinutes: z.number().optional(),
        })
      )
      .mutation(async ({ input }) => {
        try {
          console.log(`[Booking] Starting booking creation for practitioner ${input.practitionerId}`);

          const practitioner = await getPractitioner(input.practitionerId);
          if (!practitioner) {
            console.error(`[Booking] Practitioner ${input.practitionerId} not found`);
            throw new Error("Practitioner not found");
          }

          console.log(`[Booking] Practitioner found: ${practitioner.name} (${practitioner.id})`);

          // Check for booking conflicts at the same time slot
          const bookingTime = new Date(input.bookingTime);
          console.log(`[Booking] Checking for conflicts at ${bookingTime.toISOString()}`);

          const existingBooking = await checkBookingConflict(practitioner.id, bookingTime);
          if (existingBooking) {
            console.warn(`[Booking] Conflict detected: booking ${existingBooking.id} already exists`);
            throw new Error("This time slot is already booked. Please select another time.");
          }

          const selectedServicePrice = input.servicePrice ?? 25;
          const selectedServiceName = input.serviceName ?? "Cabelo";

          // Create booking in database with pending status
          console.log(`[Booking] Creating booking for practitioner ${input.practitionerId}`);
          const bookingData = {
            practitionerId: practitioner.id,
            clientName: input.clientName,
            clientEmail: input.clientEmail,
            clientPhone: input.clientPhone,
            bookingTime: bookingTime,
            status: "pending" as const,
            amount: selectedServicePrice * 100,
            stripeSessionId: null,
            stripePaymentIntentId: null,
          };

          console.log(`[Booking] Booking data prepared:`, {
            ...bookingData,
            bookingTime: bookingData.bookingTime.toISOString(),
          });

          const booking = await createBooking(bookingData);

          if (!booking || !booking.id) {
            console.error(`[Booking] Failed to create booking: no ID returned`);
            throw new Error("Failed to create booking");
          }

          console.log(`[Booking] Booking ${booking.id} created with status: pending`);

          // Create real Stripe checkout session
          console.log(`[Booking] Creating Stripe checkout session for booking ${booking.id}`);
          const checkoutSession = await createCheckoutSession({
            amount: selectedServicePrice * 100,
            currency: "BRL",
            clientEmail: input.clientEmail,
            clientName: input.clientName,
            bookingId: booking.id,
            serviceName: selectedServiceName,
          });

          console.log(`[Booking] Stripe checkout session created: ${checkoutSession.id}`);

          // Update booking with Stripe session ID
          await updateBookingWithStripeData(booking.id, checkoutSession.id, "");

          console.log(`[Booking] Booking ${booking.id} updated with Stripe session ID`);
          console.log(`[Booking] Checkout URL: ${checkoutSession.url}`);

          return {
            bookingId: booking.id,
            checkoutUrl: checkoutSession.url,
            amount: selectedServicePrice * 100,
          };
        } catch (error: any) {
          console.error(`[Booking] Error in createBooking mutation:`, error);
          console.error(`[Booking] Error message:`, error.message);
          console.error(`[Booking] Error stack:`, error.stack);
          throw error;
        }
      }),

    /**
     * Confirm booking after successful payment
     * Called by the webhook handler - creates event in Cal.com
     */
    confirmBooking: publicProcedure
      .input(
        z.object({
          stripeSessionId: z.string(),
        })
      )
      .mutation(async ({ input }) => {
        const booking = await getBookingByStripeSessionId(input.stripeSessionId);
        if (!booking) {
          throw new Error("Booking not found");
        }

        // Update booking status to confirmed
        await updateBookingStatus(booking.id, "confirmed");

        // Try to create the event in Cal.com
        try {
          const practitioner = await getPractitioner(booking.practitionerId);
          if (practitioner) {
            // Calculate end time (assuming 1 hour sessions)
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
              console.log(`[Booking] Cal.com event created: ${calComResult.eventId}`);
            } else {
              console.warn(`[Booking] Failed to create Cal.com event: ${calComResult.error}`);
            }
          }
        } catch (error) {
          console.error("[Booking] Error creating Cal.com event:", error);
          // Don't fail the booking confirmation if Cal.com fails
        }

        return {
          bookingId: booking.id,
          status: "confirmed",
        };
      }),

    getUserBookings: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return [];

      const email = ctx.user.email?.trim().toLowerCase();
      if (!email) return [];

      const rows = await db.select().from(bookings).where(eq(bookings.clientEmail, email));

      return rows.sort((a, b) => {
        const aTime = new Date(a.bookingTime).getTime();
        const bTime = new Date(b.bookingTime).getTime();
        return bTime - aTime;
      });
    }),

    getAdminBookings: adminProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];

      const rows = await db.select().from(bookings);

      return rows.sort((a, b) => {
        const aTime = new Date(a.bookingTime).getTime();
        const bTime = new Date(b.bookingTime).getTime();
        return bTime - aTime;
      });
    }),

    requestRefund: protectedProcedure
      .input(z.object({ bookingId: z.string().uuid() }))
      .mutation(async ({ input, ctx }) => {
        const booking = await getBooking(input.bookingId);
        if (!booking) {
          throw new Error("Booking not found");
        }

        const userEmail = ctx.user.email?.trim().toLowerCase();
        const isOwner = userEmail && booking.clientEmail.toLowerCase() === userEmail;
        const { resolveUserRole } = await import("./_core/roles");
        const isAdmin = resolveUserRole(ctx.user) === "admin";

        if (!isOwner && !isAdmin) {
          throw new Error("You are not allowed to refund this booking");
        }

        if (booking.status === "cancelled") {
          return {
            bookingId: booking.id,
            status: booking.status,
            refunded: false,
            message: "Booking already cancelled",
          };
        }

        let refunded = false;
        if (booking.stripePaymentIntentId) {
          try {
            await createRefund(booking.stripePaymentIntentId, booking.amount);
            refunded = true;
          } catch (error) {
            console.warn("[Booking] Refund failed:", error);
          }
        }

        await updateBookingStatus(booking.id, "cancelled");

        return {
          bookingId: booking.id,
          status: "cancelled",
          refunded,
          message: refunded ? "Refund requested successfully" : "Booking cancelled without a Stripe refund",
        };
      }),

    rescheduleBooking: protectedProcedure
      .input(
        z.object({
          bookingId: z.string().uuid(),
          bookingTime: z.string().datetime(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const booking = await getBooking(input.bookingId);
        if (!booking) {
          throw new Error("Booking not found");
        }

        const userEmail = ctx.user.email?.trim().toLowerCase();
        const isOwner = userEmail && booking.clientEmail.toLowerCase() === userEmail;
        const { resolveUserRole } = await import("./_core/roles");
        const isAdmin = resolveUserRole(ctx.user) === "admin";

        if (!isOwner && !isAdmin) {
          throw new Error("You are not allowed to reschedule this booking");
        }

        const db = await getDb();
        if (!db) {
          throw new Error("Database not available");
        }

        await db
          .update(bookings)
          .set({
            bookingTime: new Date(input.bookingTime),
            updatedAt: new Date(),
          })
          .where(eq(bookings.id, input.bookingId));

        return {
          bookingId: booking.id,
          bookingTime: input.bookingTime,
        };
      }),

    /**
     * Get booking details by ID
     */
    getBooking: publicProcedure
      .input(z.object({ bookingId: z.string().uuid() }))
      .query(async ({ input }) => {
        const booking = await getBooking(input.bookingId);
        if (!booking) {
          throw new Error("Booking not found");
        }
        return booking;
      }),

    /**
     * Get booking by Stripe session ID
     */
    getBookingBySessionId: publicProcedure
      .input(z.object({ sessionId: z.string() }))
      .query(async ({ input }) => {
        const booking = await getBookingByStripeSessionId(input.sessionId);
        if (!booking) {
          throw new Error("Booking not found");
        }
        return booking;
      }),

    /**
     * Cancel a booking and remove from Cal.com
     */
    cancelBooking: publicProcedure
      .input(
        z.object({
          bookingId: z.string().uuid(),
        })
      )
      .mutation(async ({ input }) => {
        const booking = await getBooking(input.bookingId);
        if (!booking) {
          throw new Error("Booking not found");
        }

        // Update booking status to cancelled
        await updateBookingStatus(booking.id, "cancelled");

        // Try to cancel the event in Cal.com if it exists
        try {
          // Note: You'd need to store the Cal.com event ID in the booking record
          // For now, this is a placeholder for future implementation
          console.log(`[Booking] Booking ${booking.id} cancelled - Cal.com event should be cancelled too`);
        } catch (error) {
          console.error("[Booking] Error cancelling Cal.com event:", error);
        }

        return {
          bookingId: booking.id,
          status: "cancelled",
        };
      }),
  }),
});

export type AppRouter = typeof appRouter;