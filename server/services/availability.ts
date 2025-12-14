/**
 * Cal.com availability service
 * Real integration with Cal.com API
 */

import axios from "axios";

export interface TimeSlot {
  id: string;
  startTime: Date;
  endTime: Date;
  available: boolean;
}

interface CalComAvailabilityResponse {
  busy: Array<{
    start: string;
    end: string;
  }>;
}

/**
 * Get availability from Cal.com API
 * Fetches busy slots and generates available time slots
 */
async function getCalComAvailability(
  practitionerId: string
): Promise<TimeSlot[]> {
  const apiKey = process.env.CALCOM_API_KEY;
  const calComUrl = process.env.CALCOM_API_URL || "https://api.cal.com/v1";

  console.log(
    `[Cal.com] Fetching availability for practitioner ${practitionerId}`
  );

  if (!apiKey) {
    console.warn(
      "[Availability] CALCOM_API_KEY not set, falling back to mock data"
    );
    return getMockAvailability(practitionerId);
  }

  console.log(`[Cal.com] Using CALCOM_API_KEY: ${apiKey.substring(0, 20)}...`);
  console.log(`[Cal.com] Using CALCOM_API_URL: ${calComUrl}`);

  // Declare variables outside try block for error logging
  let calComUserId: string | undefined;
  let eventTypeId: string | undefined;
  let requestUrl = "";

  try {
    // Map practitioner ID to Cal.com user/event type
    // Using single CALCOM_USER_ID for all practitioners, each with their own event type
    calComUserId = process.env.CALCOM_USER_ID;
    
    // Try multiple strategies to find eventTypeId:
    // 1. Try with UUID as-is (with hífens substituídos por underscores)
    // 2. Try with UUID sem hífens
    // 3. Try with primeiros 8 caracteres do UUID
    // 4. Try default event type
    const uuidNormalized = practitionerId.replace(/-/g, '_');
    const uuidNoHyphens = practitionerId.replace(/-/g, '');
    const uuidShort = practitionerId.substring(0, 8);
    
    eventTypeId = 
      process.env[`CALCOM_EVENT_TYPE_${uuidNormalized}`] ||
      process.env[`CALCOM_EVENT_TYPE_${uuidNoHyphens}`] ||
      process.env[`CALCOM_EVENT_TYPE_${uuidShort}`] ||
      process.env.CALCOM_EVENT_TYPE_DEFAULT;

    if (!calComUserId || !eventTypeId) {
      console.warn(
        `[Cal.com] Missing environment variables for practitioner ${practitionerId}`
      );
      console.warn(
        `[Cal.com] Tried: CALCOM_EVENT_TYPE_${uuidNormalized}, CALCOM_EVENT_TYPE_${uuidNoHyphens}, CALCOM_EVENT_TYPE_${uuidShort}, CALCOM_EVENT_TYPE_DEFAULT`
      );
      console.warn(
        `[Cal.com] Please set CALCOM_USER_ID and one of the event type variables above`
      );
    }

    console.log(
      `[Cal.com] Mapped practitioner ${practitionerId} to userId: ${calComUserId}, eventTypeId: ${eventTypeId}`
    );

    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() + 1);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 14);

    console.log(
      `[Cal.com] Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`
    );

    // Fetch busy slots from Cal.com
    requestUrl = `${calComUrl}/availability`;
    const requestParams = {
      userId: calComUserId,
      eventTypeId: eventTypeId,
      dateFrom: startDate.toISOString(),
      dateTo: endDate.toISOString(),
      apiKey: apiKey,
    };

    console.log(`[Cal.com] Making request to: ${requestUrl}`);
    console.log(`[Cal.com] Request params:`, requestParams);

    const response = await axios.get<CalComAvailabilityResponse>(requestUrl, {
      params: requestParams,
      timeout: 5000,
    });

    console.log(`[Cal.com] Response status: ${response.status}`);
    console.log(`[Cal.com] Response data:`, response.data);

    const busySlots = response.data.busy.map((slot: any) => ({
      start: new Date(slot.start),
      end: new Date(slot.end),
    }));

    // Generate all possible time slots
    const allSlots = generateTimeSlots(startDate, endDate);

    // Mark slots as unavailable if they overlap with busy slots
    return allSlots.map(slot => ({
      ...slot,
      available: !isSlotBusy(slot, busySlots),
    }));
  } catch (error) {
    console.error("[Availability] Failed to fetch from Cal.com API:", error);
    console.error("[Availability] Error details:", {
      practitionerId,
      calComUserId,
      eventTypeId,
      requestUrl,
      error: error instanceof Error ? error.message : String(error)
    });
    console.log("[Availability] Falling back to mock data due to API failure");

    // Fallback to mock data on error
    return getMockAvailability(practitionerId);
  }
}

/**
 * Generate time slots for business hours (9am-5pm, weekdays only)
 */
function generateTimeSlots(startDate: Date, endDate: Date): TimeSlot[] {
  const slots: TimeSlot[] = [];
  const currentDate = new Date(startDate);

  while (currentDate < endDate) {
    // Skip weekends
    if (currentDate.getDay() !== 0 && currentDate.getDay() !== 6) {
      // Create slots for business hours: 9am, 11am, 1pm, 3pm, 5pm
      const hours = [9, 11, 13, 15, 17];
      hours.forEach(hour => {
        const startTime = new Date(currentDate);
        startTime.setHours(hour, 0, 0, 0);

        const endTime = new Date(startTime);
        endTime.setHours(hour + 1, 0, 0, 0);

        slots.push({
          id: `${startTime.getTime()}`,
          startTime,
          endTime,
          available: true, // Will be updated based on busy slots
        });
      });
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return slots;
}

/**
 * Check if a time slot overlaps with any busy slots
 */
function isSlotBusy(
  slot: TimeSlot,
  busySlots: Array<{ start: Date; end: Date }>
): boolean {
  return busySlots.some(busy => {
    return (
      (slot.startTime >= busy.start && slot.startTime < busy.end) ||
      (slot.endTime > busy.start && slot.endTime <= busy.end) ||
      (slot.startTime <= busy.start && slot.endTime >= busy.end)
    );
  });
}

/**
 * Generate mock availability slots for the next 7-14 days
 * Each day has 5 slots: 9am, 11am, 1pm, 3pm, 5pm
 * Used as fallback when Cal.com API is not available
 */
function getMockAvailability(practitionerId: string): TimeSlot[] {
  const slots: TimeSlot[] = [];
  const now = new Date();

  // Start from tomorrow
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() + 1);
  startDate.setHours(0, 0, 0, 0);

  // Generate slots for next 14 days
  for (let day = 0; day < 14; day++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + day);

    // Skip weekends
    if (date.getDay() === 0 || date.getDay() === 6) {
      continue;
    }

    // Create 5 slots per day
    const hours = [9, 11, 13, 15, 17];
    hours.forEach(hour => {
      const startTime = new Date(date);
      startTime.setHours(hour, 0, 0, 0);

      const endTime = new Date(startTime);
      endTime.setHours(hour + 1, 0, 0, 0);

      // Mock: 70% of slots are available
      const available = Math.random() > 0.3;

      slots.push({
        id: `${practitionerId}-${day}-${hour}`,
        startTime,
        endTime,
        available,
      });
    });
  }

  return slots;
}

/**
 * Get availability for a specific practitioner
 * This would be called from the tRPC procedure
 */
export async function getAvailabilityForPractitioner(
  practitionerId: string
): Promise<TimeSlot[]> {
  console.log(
    `[Availability] getAvailabilityForPractitioner called for practitioner ${practitionerId}`
  );

  // Try to get real availability from Cal.com API
  console.log(`[Availability] Attempting to fetch real Cal.com data`);
  const slots = await getCalComAvailability(practitionerId);

  console.log(`[Availability] Returning ${slots.length} slots from Cal.com API`);
  return slots;
}

/**
 * Create a booking/meeting in Cal.com when payment is confirmed
 * This should be called after successful Stripe payment
 */
export async function createCalComBooking(bookingData: {
  practitionerId: string;
  clientName: string;
  clientEmail: string;
  clientPhone?: string;
  startTime: Date;
  endTime: Date;
  title?: string;
  timeZone?: string;
}): Promise<{ success: boolean; eventId?: string; error?: string }> {
  const apiKey = process.env.CALCOM_API_KEY;
  const calComUrl = process.env.CALCOM_API_URL || "https://api.cal.com/v1";

  console.log(`[Cal.com] Creating booking for practitioner ${bookingData.practitionerId}`);

  if (!apiKey) {
    console.warn("[Cal.com] CALCOM_API_KEY not set, cannot create booking");
    return { success: false, error: "API key not configured" };
  }

  try {
    // Get the correct userId and eventTypeId for this practitioner
    // Using single CALCOM_USER_ID for all practitioners, each with their own event type
    const calComUserId = process.env.CALCOM_USER_ID;
    
    // Try multiple strategies to find eventTypeId:
    // 1. Try with UUID as-is (with hífens substituídos por underscores)
    // 2. Try with UUID sem hífens
    // 3. Try with primeiros 8 caracteres do UUID
    // 4. Try default event type
    const uuidNormalized = bookingData.practitionerId.replace(/-/g, '_');
    const uuidNoHyphens = bookingData.practitionerId.replace(/-/g, '');
    const uuidShort = bookingData.practitionerId.substring(0, 8);
    
    let eventTypeId = 
      process.env[`CALCOM_EVENT_TYPE_${uuidNormalized}`] ||
      process.env[`CALCOM_EVENT_TYPE_${uuidNoHyphens}`] ||
      process.env[`CALCOM_EVENT_TYPE_${uuidShort}`] ||
      process.env.CALCOM_EVENT_TYPE_DEFAULT;

    if (!calComUserId) {
      console.warn(`[Cal.com] Missing CALCOM_USER_ID environment variable`);
      return { success: false, error: "CALCOM_USER_ID not configured" };
    }

    if (!eventTypeId) {
      console.warn(`[Cal.com] Missing event type configuration for practitioner ${bookingData.practitionerId}`);
      console.warn(`[Cal.com] Tried: CALCOM_EVENT_TYPE_${uuidNormalized}, CALCOM_EVENT_TYPE_${uuidNoHyphens}, CALCOM_EVENT_TYPE_${uuidShort}, CALCOM_EVENT_TYPE_DEFAULT`);
      console.warn(`[Cal.com] Please set one of these environment variables or CALCOM_EVENT_TYPE_DEFAULT`);
      return { success: false, error: "Practitioner configuration missing: eventTypeId not found" };
    }

    console.log(`[Cal.com] Using eventTypeId: ${eventTypeId} for practitioner ${bookingData.practitionerId}`);

    // Prepare the booking data for Cal.com API
    const bookingPayload = {
      eventTypeId: Number(eventTypeId),
      start: bookingData.startTime.toISOString(),
      end: bookingData.endTime.toISOString(),

      responses: {
        name: bookingData.clientName,
        email: bookingData.clientEmail,
        smsReminderNumber: "",
        location: {
          value: "userPhone",
          optionValue: bookingData.clientPhone || "",
        },
      },

      timeZone: bookingData.timeZone || "America/Recife",
      language: "en",
      title: bookingData.title || "Booking",
      description: null,
      status: "PENDING",
      metadata: {},
    };


    console.log(`[Cal.com] Creating booking with payload:`, bookingPayload);
    console.log(`[Cal.com] Request URL: ${calComUrl}/bookings`);
    console.log(`[Cal.com] Using API Key: ${apiKey.substring(0, 20)}...`);

    // Create the booking via Cal.com API
    const response = await axios.post(
      `https://api.cal.com/v1/bookings?apiKey=${apiKey}`,
      bookingPayload,
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    console.log(`[Cal.com] Booking created successfully:`, response.data);

    return {
      success: true,
      eventId: response.data.id || response.data.uid,
    };

  } catch (error: any) {
    console.error("[Cal.com] Failed to create booking:", error.response?.data || error);

    // Handle specific error types
    if (error.response) {
      const status = error.response.status;
      const errorData = error.response.data;
      const responseHeaders = error.response.headers;

      console.error(`[Cal.com] API Error ${status}:`, errorData);

      if (status === 400) {
        return { success: false, error: `Bad Request (400): ${errorData?.message || 'Invalid booking data or time conflict'}` };
      } else if (status === 404) {
        return { success: false, error: "Event type or user not found" };
      } else if (status === 409) {
        return { success: false, error: "Time slot already booked" };
      }
    }

    return {
      success: false,
      error: error.message || "Unknown error creating booking"
    };
  }
}

/**
 * Cancel a booking in Cal.com
 * Should be called when a booking is cancelled
 */
export async function cancelCalComBooking(bookingUid: string): Promise<{ success: boolean; error?: string }> {
  const apiKey = process.env.CALCOM_API_KEY;
  const calComUrl = process.env.CALCOM_API_URL || "https://api.cal.com/v1";

  console.log(`[Cal.com] Cancelling booking ${bookingUid}`);

  if (!apiKey) {
    console.warn("[Cal.com] CALCOM_API_KEY not set, cannot cancel booking");
    return { success: false, error: "API key not configured" };
  }

  try {
    const response = await axios.delete(`${calComUrl}/bookings/${bookingUid}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      timeout: 5000,
    });

    console.log(`[Cal.com] Booking cancelled successfully:`, bookingUid);
    return { success: true };

  } catch (error: any) {
    console.error("[Cal.com] Failed to cancel booking:", error);

    if (error.response) {
      const status = error.response.status;
      if (status === 404) {
        return { success: false, error: "Booking not found" };
      }
    }

    return {
      success: false,
      error: error.message || "Unknown error cancelling booking"
    };
  }
}
