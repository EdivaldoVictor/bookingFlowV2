import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
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
import { practitioners } from "../drizzle/schema";
import { createCalComBooking, cancelCalComBooking } from "./services/availability";
import { getAvailabilityForPractitioner } from "./services/availability";
import { createCheckoutSession } from "./services/stripe";

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
        const result = await db
          .select()
          .from(practitioners);

        console.log(`[Router] Found ${result.length} practitioners in database`);
        return result;
      } catch (error) {    
        throw new Error("Error fetching practitioners");
      }
    }),
  }),

  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
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
        console.log(
          `[Router] getAvailability called with practitionerId: ${input.practitionerId}`
        );

        const practitioner = await getPractitioner(input.practitionerId);
        console.log(`[Router] Practitioner found:`, practitioner);

        if (!practitioner) {
          throw new Error("Practitioner not found");
        }

        console.log(`[Router] Calling getAvailabilityForPractitioner...`);
        const slots = await getAvailabilityForPractitioner(
          input.practitionerId
        );
        console.log(
          `[Router] Got ${slots.length} slots from availability service`
        );

        const availableSlots = slots.filter(s => s.available);
        console.log(
          `[Router] Filtered to ${availableSlots.length} available slots`
        );

        return {
          practitioner,
          slots: availableSlots,
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
          
          const existingBooking = await checkBookingConflict(
            input.practitionerId,
            bookingTime
          );
          if (existingBooking) {
            console.warn(`[Booking] Conflict detected: booking ${existingBooking.id} already exists`);
            throw new Error(
              "This time slot is already booked. Please select another time."
            );
          }

          // Create booking in database with pending status
          console.log(`[Booking] Creating booking for practitioner ${input.practitionerId}`);
          const bookingData = {
            practitionerId: input.practitionerId,
            clientName: input.clientName,
            clientEmail: input.clientEmail,
            clientPhone: input.clientPhone,
            bookingTime: bookingTime,
            status: "pending" as const,
            amount: practitioner.hourlyRate,
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
            amount: practitioner.hourlyRate,
            currency: "GBP",
            clientEmail: input.clientEmail,
            clientName: input.clientName,
            bookingId: booking.id,
          });

          console.log(`[Booking] Stripe checkout session created: ${checkoutSession.id}`);

          // Update booking with Stripe session ID
          await updateBookingWithStripeData(booking.id, checkoutSession.id, "");

          console.log(`[Booking] Booking ${booking.id} updated with Stripe session ID`);
          console.log(`[Booking] Checkout URL: ${checkoutSession.url}`);

          return {
            bookingId: booking.id,
            checkoutUrl: checkoutSession.url,
            amount: practitioner.hourlyRate,
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
        const booking = await getBookingByStripeSessionId(
          input.stripeSessionId
        );
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
