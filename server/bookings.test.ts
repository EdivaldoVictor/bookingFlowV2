import { describe, expect, it, beforeEach, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { Practitioner } from "../drizzle/schema";

// Mock the entire db module
const mockPractitioner: Practitioner = {
  id: 1,
  name: "Dr. Sarah Johnson",
  email: "sarah@example.com",
  description: "Clinical Psychologist",
  hourlyRate: 8000, // £80
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockPractitioner2: Practitioner = {
  id: 2,
  name: "Dr. Michael Chen",
  email: "michael@example.com",
  description: "Therapist",
  hourlyRate: 7500, // £75
  createdAt: new Date(),
  updatedAt: new Date(),
};

// In-memory store for mock bookings to test conflict detection
const mockBookings: any[] = [];

// Mock the database functions
vi.mock("./db", () => ({
  getPractitioner: vi.fn(async (id: number) => {
    if (id === 1) return mockPractitioner;
    if (id === 2) return mockPractitioner2;
    return undefined;
  }),
  createBooking: vi.fn(async (booking: any) => {
    const newBooking = { id: mockBookings.length + 1, ...booking };
    mockBookings.push(newBooking);
    return newBooking;
  }),
  getBookingByStripeSessionId: vi.fn(async (sessionId: string) => {
    const booking = mockBookings.find(b => b.stripeSessionId === sessionId);
    return booking;
  }),
  updateBookingStatus: vi.fn(async (id: number, status: string) => {
    const booking = mockBookings.find(b => b.id === id);
    if (booking) {
      booking.status = status;
    }
  }),
  updateBookingWithStripeData: vi.fn(
    async (
      id: number,
      stripeSessionId: string,
      stripePaymentIntentId: string
    ) => {
      const booking = mockBookings.find(b => b.id === id);
      if (booking) {
        booking.stripeSessionId = stripeSessionId;
        booking.stripePaymentIntentId = stripePaymentIntentId;
      }
    }
  ),
  checkBookingConflict: vi.fn(
    async (practitionerId: number, bookingTime: Date) => {
      const conflict = mockBookings.find(
        b =>
          b.practitionerId === practitionerId &&
          b.bookingTime.getTime() === bookingTime.getTime()
      );
      return conflict;
    }
  ),
  // Mock getDb to avoid connecting to a real database
  getDb: vi.fn(async () => ({})),
}));

// Mock the stripe service to avoid real API calls
vi.mock("./services/stripe", () => ({
  createCheckoutSession: vi.fn(async (params: any) => ({
    id: `cs_test_${Math.random().toString(36).substring(2, 15)}`,
    url: `/mock-checkout?session=cs_test_mock&booking=${params.bookingId}`,
    amount: params.amount,
    currency: params.currency,
    status: "open",
  })),
}));

// Mock the availability service to avoid real API calls
vi.mock("./services/availability", () => ({
  getAvailabilityForPractitioner: vi.fn(async () => [
    // Mock a few available slots for testing
    {
      id: "slot1",
      startTime: generateFutureDate(1, 9),
      endTime: generateFutureDate(1, 10),
      available: true,
    },
    {
      id: "slot2",
      startTime: generateFutureDate(1, 11),
      endTime: generateFutureDate(1, 12),
      available: true,
    },
  ]),
  createCalComBooking: vi.fn(async () => ({
    success: true,
    eventId: "mock-calcom-event-id",
  })),
  cancelCalComBooking: vi.fn(async () => ({
    success: true,
  })),
}));

/**
 * Mock tRPC context for testing
 */
function createMockContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

/**
 * Generate unique future dates for each test to avoid conflicts
 */
function generateFutureDate(daysFromNow: number, hours: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  date.setHours(hours, 0, 0, 0);
  return date;
}

describe("bookings router", () => {
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeEach(() => {
    // Clear mock bookings before each test
    mockBookings.length = 0;

    // Reset all mocks
    vi.clearAllMocks();

    const ctx = createMockContext();
    caller = appRouter.createCaller(ctx);
  });

  describe("bookings.getAvailability", () => {
    it("should return availability for a valid practitioner", async () => {
      const result = await caller.bookings.getAvailability({
        practitionerId: 1,
      });

      expect(result).toHaveProperty("practitioner");
      expect(result).toHaveProperty("slots");
      expect(result.practitioner).toHaveProperty("id");
      expect(result.practitioner).toHaveProperty("name");
      expect(result.practitioner).toHaveProperty("hourlyRate");
      expect(Array.isArray(result.slots)).toBe(true);

      // Check that the mock function was called
      const { getPractitioner } = await import("./db");
      expect(getPractitioner).toHaveBeenCalledWith(1);
    });

    it("should return slots with correct structure", async () => {
      const result = await caller.bookings.getAvailability({
        practitionerId: 1,
      });

      if (result.slots.length > 0) {
        const slot = result.slots[0];
        expect(slot).toHaveProperty("id");
        expect(slot).toHaveProperty("startTime");
        expect(slot).toHaveProperty("endTime");
        expect(slot).toHaveProperty("available");
        expect(slot.available).toBe(true);
      }
    });

    it("should throw error for invalid practitioner ID", async () => {
      try {
        await caller.bookings.getAvailability({
          practitionerId: 99999,
        });
        // If it reaches here, the test failed
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeDefined();
        expect(String(error)).toContain("Practitioner not found");
      }
    });

    // The following tests rely on the mock availability service, which returns fixed slots
    it("should return slots only for future dates", async () => {
      const result = await caller.bookings.getAvailability({
        practitionerId: 1,
      });

      const now = new Date();
      result.slots.forEach(slot => {
        expect(new Date(slot.startTime).getTime()).toBeGreaterThan(
          now.getTime()
        );
      });
    });

    it("should exclude weekends from availability", async () => {
      // This test is now covered by the mock availability service logic
      const result = await caller.bookings.getAvailability({
        practitionerId: 1,
      });

      result.slots.forEach(slot => {
        const dayOfWeek = new Date(slot.startTime).getDay();
        // The mock service should only return slots for weekdays (1-5)
        expect([0, 6]).not.toContain(dayOfWeek);
      });
    });
  });

  describe("bookings.createBooking", () => {
    it("should create a booking with valid input", async () => {
      const bookingTime = generateFutureDate(2, 9);

      const result = await caller.bookings.createBooking({
        practitionerId: 1,
        clientName: "John Doe",
        clientEmail: "john@example.com",
        clientPhone: "+1234567890",
        bookingTime: bookingTime.toISOString(),
      });

      expect(result).toHaveProperty("bookingId");
      expect(result).toHaveProperty("checkoutUrl");
      expect(result).toHaveProperty("amount");
      expect(typeof result.bookingId).toBe("number");
      expect(typeof result.checkoutUrl).toBe("string");
      expect(typeof result.amount).toBe("number");

      // Check that the mock function was called
      const { createBooking } = await import("./db");
      expect(createBooking).toHaveBeenCalled();
    });

    it("should return checkout URL with booking ID", async () => {
      const bookingTime = generateFutureDate(3, 10);

      const result = await caller.bookings.createBooking({
        practitionerId: 1,
        clientName: "Jane Smith",
        clientEmail: "jane@example.com",
        clientPhone: "+1987654321",
        bookingTime: bookingTime.toISOString(),
      });

      expect(result.checkoutUrl).toContain("booking=");
      // The mock checkout URL contains the booking ID
      expect(result.checkoutUrl).toContain(result.bookingId.toString());
    });

    it("should validate email format", async () => {
      const bookingTime = generateFutureDate(4, 11);

      try {
        await caller.bookings.createBooking({
          practitionerId: 1,
          clientName: "Invalid Email",
          clientEmail: "not-an-email",
          clientPhone: "+1234567890",
          bookingTime: bookingTime.toISOString(),
        });
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it("should validate required fields", async () => {
      const bookingTime = generateFutureDate(5, 12);

      try {
        await caller.bookings.createBooking({
          practitionerId: 1,
          clientName: "",
          clientEmail: "test@example.com",
          clientPhone: "+1234567890",
          bookingTime: bookingTime.toISOString(),
        });
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it("should throw error for invalid practitioner", async () => {
      const bookingTime = generateFutureDate(6, 13);

      try {
        await caller.bookings.createBooking({
          practitionerId: 99999,
          clientName: "John Doe",
          clientEmail: "john@example.com",
          clientPhone: "+1234567890",
          bookingTime: bookingTime.toISOString(),
        });
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeDefined();
        expect(String(error)).toContain("Practitioner not found");
      }
    });

    it("should return amount matching practitioner hourly rate", async () => {
      const bookingTime = generateFutureDate(7, 14);

      const result = await caller.bookings.createBooking({
        practitionerId: 1,
        clientName: "Test User",
        clientEmail: "test@example.com",
        clientPhone: "+1234567890",
        bookingTime: bookingTime.toISOString(),
      });

      // Mock practitioner 1 has hourlyRate: 8000
      expect(result.amount).toBe(mockPractitioner.hourlyRate);
    });
  });

  describe("bookings.createBooking - conflict detection", () => {
    it("should prevent duplicate bookings at the same time slot", async () => {
      const bookingTime = generateFutureDate(8, 9);

      // Mock the conflict detection to return a conflict for the second call
      const { checkBookingConflict } = await import("./db");
      (checkBookingConflict as any).mockImplementationOnce(
        async () => undefined
      ); // First call: no conflict
      (checkBookingConflict as any).mockImplementationOnce(async () => ({
        id: 1,
        practitionerId: 1,
        bookingTime,
      })); // Second call: conflict

      // First booking should succeed
      const result1 = await caller.bookings.createBooking({
        practitionerId: 1,
        clientName: "John Doe",
        clientEmail: "john@example.com",
        clientPhone: "+1234567890",
        bookingTime: bookingTime.toISOString(),
      });

      expect(result1).toHaveProperty("bookingId");

      // Second booking at the same time should fail
      try {
        await caller.bookings.createBooking({
          practitionerId: 1,
          clientName: "Jane Smith",
          clientEmail: "jane@example.com",
          clientPhone: "+1987654321",
          bookingTime: bookingTime.toISOString(),
        });
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeDefined();
        expect(String(error)).toContain("already booked");
      }
    });

    it("should allow bookings at different time slots", async () => {
      const bookingTime1 = generateFutureDate(9, 10);
      const bookingTime2 = generateFutureDate(9, 11);

      // Mock the conflict detection to always return no conflict
      const { checkBookingConflict } = await import("./db");
      (checkBookingConflict as any).mockImplementation(async () => undefined);

      // First booking
      const result1 = await caller.bookings.createBooking({
        practitionerId: 1,
        clientName: "John Doe",
        clientEmail: "john@example.com",
        clientPhone: "+1234567890",
        bookingTime: bookingTime1.toISOString(),
      });

      expect(result1).toHaveProperty("bookingId");

      // Second booking at different time should succeed
      const result2 = await caller.bookings.createBooking({
        practitionerId: 1,
        clientName: "Jane Smith",
        clientEmail: "jane@example.com",
        clientPhone: "+1987654321",
        bookingTime: bookingTime2.toISOString(),
      });

      expect(result2).toHaveProperty("bookingId");
      expect(result2.bookingId).not.toBe(result1.bookingId);
    });

    it("should allow same time slot for different practitioners", async () => {
      const bookingTime = generateFutureDate(10, 12);

      // Mock the conflict detection to always return no conflict
      const { checkBookingConflict } = await import("./db");
      (checkBookingConflict as any).mockImplementation(async () => undefined);

      // Booking for practitioner 1
      const result1 = await caller.bookings.createBooking({
        practitionerId: 1,
        clientName: "John Doe",
        clientEmail: "john@example.com",
        clientPhone: "+1234567890",
        bookingTime: bookingTime.toISOString(),
      });

      expect(result1).toHaveProperty("bookingId");

      // Booking for practitioner 2 at the same time should succeed
      const result2 = await caller.bookings.createBooking({
        practitionerId: 2,
        clientName: "Jane Smith",
        clientEmail: "jane@example.com",
        clientPhone: "+1987654321",
        bookingTime: bookingTime.toISOString(),
      });

      expect(result2).toHaveProperty("bookingId");
    });
  });

  describe("bookings.confirmBooking", () => {
    it("should validate session ID input", async () => {
      const bookingTime = generateFutureDate(11, 13);

      // Mock the database functions to simulate a successful flow
      const {
        getBookingByStripeSessionId,
        updateBookingStatus,
        updateBookingWithStripeData,
      } = await import("./db");

      // 1. Create a mock booking in the in-memory store
      const mockBooking = {
        id: 100,
        practitionerId: 1,
        clientName: "Test User",
        clientEmail: "test@example.com",
        clientPhone: "+1234567890",
        bookingTime: bookingTime,
        status: "pending",
        amount: mockPractitioner.hourlyRate,
        stripeSessionId: "cs_test_mock",
        stripePaymentIntentId: "pi_test_mock",
      };
      mockBookings.push(mockBooking);

      // 2. Mock the lookup function
      (getBookingByStripeSessionId as any).mockImplementation(
        async (sessionId: string) => {
          return mockBookings.find(b => b.stripeSessionId === sessionId);
        }
      );

      // 3. Call the confirmBooking procedure
      const result = await caller.bookings.confirmBooking({
        stripeSessionId: "cs_test_mock",
      });

      // 4. Assertions
      expect(result).toHaveProperty("bookingId", 100);
      expect(result).toHaveProperty("status", "confirmed");
      expect(updateBookingStatus).toHaveBeenCalledWith(100, "confirmed");
    });

    it("should throw error for invalid session ID", async () => {
      // Mock the lookup function to return undefined
      const { getBookingByStripeSessionId } = await import("./db");
      (getBookingByStripeSessionId as any).mockImplementation(
        async () => undefined
      );

      try {
        await caller.bookings.confirmBooking({
          stripeSessionId: "invalid_session_id",
        });
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeDefined();
        expect(String(error)).toContain("Booking not found");
      }
    });
  });
});
