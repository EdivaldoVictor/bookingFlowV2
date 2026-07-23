/**
 * Cal.com availability service
 * Real integration with Cal.com API v2
 * Docs: https://cal.com/docs/api-reference/v2
 */

import axios from "axios";

export interface TimeSlot {
  id: string;
  startTime: Date;
  endTime: Date;
  available: boolean;
}

/** Cal.com API version headers required by v2 endpoints */
const CAL_API_VERSION_SLOTS = "2024-09-04";
const CAL_API_VERSION_BOOKINGS = "2026-02-25";

const DEFAULT_CALCOM_URL = "https://api.cal.com/v2";
const DEFAULT_TIMEZONE = "America/Recife";

export function normalizePhoneNumber(input?: string): string | undefined {
  if (!input) return undefined;

  const trimmed = input.trim();
  if (!trimmed) return undefined;

  const cleaned = trimmed.replace(/[^\d+]/g, "");
  if (!cleaned) return undefined;

  if (cleaned.startsWith("00")) {
    return `+${cleaned.slice(2)}`;
  }

  if (cleaned.startsWith("+")) {
    return /^\+\d{8,15}$/.test(cleaned) ? cleaned : undefined;
  }

  if (cleaned.startsWith("55") && cleaned.length >= 12) {
    return `+${cleaned}`;
  }

  if (cleaned.length === 10 || cleaned.length === 11) {
    return `+55${cleaned}`;
  }

  return undefined;
}

interface CalComSlotsResponse {
  status: string;
  data: Record<
    string,
    Array<{
      start: string;
      end?: string;
    }>
  >;
}

interface CalComBookingResponse {
  status: string;
  data: {
    id: number;
    uid: string;
    [key: string]: unknown;
  };
}

function getCalComBaseUrl(): string {
  const url = process.env.CALCOM_API_URL || DEFAULT_CALCOM_URL;
  // Migrate any leftover v1 config automatically
  return url.replace(/\/v1\/?$/, "/v2");
}

function getAuthHeaders(apiKey: string, apiVersion: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "cal-api-version": apiVersion,
  };
}

/**
 * Resolve Cal.com event type ID for a practitioner UUID.
 * Tries several env key formats for backwards compatibility.
 */
function resolveEventTypeId(practitionerId: string): string | undefined {
  const uuidNormalized = practitionerId.replace(/-/g, "_");
  const uuidNoHyphens = practitionerId.replace(/-/g, "");
  const uuidShort = practitionerId.substring(0, 8);

  return (
    process.env[`CALCOM_EVENT_TYPE_${uuidNormalized}`] ||
    process.env[`CALCOM_EVENT_TYPE_${uuidNoHyphens}`] ||
    process.env[`CALCOM_EVENT_TYPE_${uuidShort}`] ||
    process.env.CALCOM_EVENT_TYPE_DEFAULT
  );
}

/**
 * Get availability from Cal.com API v2 slots endpoint.
 * GET /v2/slots?eventTypeId=...&start=...&end=...&format=range
 */
async function getCalComAvailability(
  practitionerId: string
): Promise<TimeSlot[]> {
  const apiKey = process.env.CALCOM_API_KEY;
  const calComUrl = getCalComBaseUrl();

  console.log(
    `[Cal.com] Fetching availability for practitioner ${practitionerId}`
  );

  if (!apiKey) {
    throw new Error("CALCOM_API_KEY is not set in environment variables");
  }

  console.log(`[Cal.com] Using CALCOM_API_KEY: ${apiKey.substring(0, 20)}...`);
  console.log(`[Cal.com] Using CALCOM_API_URL: ${calComUrl}`);

  let eventTypeId: string | undefined;
  let requestUrl = "";

  try {
    eventTypeId = resolveEventTypeId(practitionerId);

    if (!eventTypeId) {
      const uuidNormalized = practitionerId.replace(/-/g, "_");
      const uuidNoHyphens = practitionerId.replace(/-/g, "");
      const uuidShort = practitionerId.substring(0, 8);
      console.warn(
        `[Cal.com] Missing environment variables for practitioner ${practitionerId}`
      );
      console.warn(
        `[Cal.com] Tried: CALCOM_EVENT_TYPE_${uuidNormalized}, CALCOM_EVENT_TYPE_${uuidNoHyphens}, CALCOM_EVENT_TYPE_${uuidShort}, CALCOM_EVENT_TYPE_DEFAULT`
      );
      throw new Error(
        "Missing CALCOM_EVENT_TYPE configuration for practitioner"
      );
    }

    console.log(
      `[Cal.com] Mapped practitioner ${practitionerId} to eventTypeId: ${eventTypeId}`
    );

    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() + 1);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 14);

    // v2 slots expects ISO dates; date-only form is also accepted
    const start = startDate.toISOString().split("T")[0];
    const end = endDate.toISOString().split("T")[0];

    console.log(`[Cal.com] Date range: ${start} to ${end}`);

    requestUrl = `${calComUrl}/slots`;
    const requestParams = {
      eventTypeId: Number(eventTypeId),
      start,
      end,
      format: "range",
      timeZone: process.env.CALCOM_TIMEZONE || DEFAULT_TIMEZONE,
    };

    console.log(`[Cal.com] Making request to: ${requestUrl}`);
    console.log(`[Cal.com] Request params:`, requestParams);

    const response = await axios.get<CalComSlotsResponse>(requestUrl, {
      params: requestParams,
      headers: getAuthHeaders(apiKey, CAL_API_VERSION_SLOTS),
      timeout: 10000,
    });

    console.log(`[Cal.com] Response status: ${response.status}`);
    console.log(`[Cal.com] Response data:`, JSON.stringify(response.data).slice(0, 500));

    const slotsData = response.data?.data ?? {};
    const slots: TimeSlot[] = [];

    for (const dateKey of Object.keys(slotsData)) {
      const daySlots = slotsData[dateKey] || [];
      for (const slot of daySlots) {
        const startTime = new Date(slot.start);
        // When format=range, end is provided; otherwise assume 1 hour
        const endTime = slot.end
          ? new Date(slot.end)
          : new Date(startTime.getTime() + 60 * 60 * 1000);

        slots.push({
          id: `${startTime.getTime()}`,
          startTime,
          endTime,
          available: true,
        });
      }
    }

    // Sort chronologically
    slots.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

    console.log(`[Cal.com] Parsed ${slots.length} available slots`);
    return slots;
  } catch (error) {
    console.error("[Availability] Failed to fetch from Cal.com API:", error);
    console.error("[Availability] Error details:", {
      practitionerId,
      eventTypeId,
      requestUrl,
      error: error instanceof Error ? error.message : String(error),
      responseData:
        axios.isAxiosError(error) ? error.response?.data : undefined,
    });

    throw new Error("Failed to fetch availability from Cal.com API");
  }
}

/**
 * Get availability for a specific practitioner.
 * Called from the tRPC procedure.
 */
export async function getAvailabilityForPractitioner(
  practitionerId: string
): Promise<TimeSlot[]> {
  console.log(
    `[Availability] getAvailabilityForPractitioner called for practitioner ${practitionerId}`
  );

  console.log(`[Availability] Attempting to fetch real Cal.com data`);
  const slots = await getCalComAvailability(practitionerId);

  console.log(
    `[Availability] Returning ${slots.length} slots from Cal.com API`
  );
  return slots;
}

/**
 * Create a booking/meeting in Cal.com when payment is confirmed.
 * POST /v2/bookings
 * Docs: https://cal.com/docs/api-reference/v2/bookings/create-a-booking
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
  const calComUrl = getCalComBaseUrl();

  console.log(
    `[Cal.com] Creating booking for practitioner ${bookingData.practitionerId}`
  );

  if (!apiKey) {
    console.warn("[Cal.com] CALCOM_API_KEY not set, cannot create booking");
    return { success: false, error: "API key not configured" };
  }

  try {
    const eventTypeId = resolveEventTypeId(bookingData.practitionerId);

    if (!eventTypeId) {
      const uuidNormalized = bookingData.practitionerId.replace(/-/g, "_");
      const uuidNoHyphens = bookingData.practitionerId.replace(/-/g, "");
      const uuidShort = bookingData.practitionerId.substring(0, 8);
      console.warn(
        `[Cal.com] Missing event type configuration for practitioner ${bookingData.practitionerId}`
      );
      console.warn(
        `[Cal.com] Tried: CALCOM_EVENT_TYPE_${uuidNormalized}, CALCOM_EVENT_TYPE_${uuidNoHyphens}, CALCOM_EVENT_TYPE_${uuidShort}, CALCOM_EVENT_TYPE_DEFAULT`
      );
      return {
        success: false,
        error: "Practitioner configuration missing: eventTypeId not found",
      };
    }

    console.log(
      `[Cal.com] Using eventTypeId: ${eventTypeId} for practitioner ${bookingData.practitionerId}`
    );

    // v2 booking payload — start must be UTC ISO 8601
    const attendee: {
      name: string;
      email: string;
      timeZone: string;
      language: string;
      phoneNumber?: string;
    } = {
      name: bookingData.clientName,
      email: bookingData.clientEmail,
      timeZone: bookingData.timeZone || DEFAULT_TIMEZONE,
      language: "en",
    };

    const normalizedPhone = normalizePhoneNumber(bookingData.clientPhone);
    if (normalizedPhone) {
      attendee.phoneNumber = normalizedPhone;
    }

    // Do not set location.type = "attendeePhone" here.
    // Event types configured for video (Google Meet, Zoom, etc.) only accept
    // location type "integration". Omitting location lets Cal.com use the
    // event type's default. Phone is still sent on attendee.phoneNumber above.
    const bookingPayload: Record<string, unknown> = {
      eventTypeId: Number(eventTypeId),
      start: bookingData.startTime.toISOString(),
      attendee,
      metadata: {},
    };

    console.log(`[Cal.com] Creating booking with payload:`, bookingPayload);
    console.log(`[Cal.com] Request URL: ${calComUrl}/bookings`);
    console.log(`[Cal.com] Using API Key: ${apiKey.substring(0, 20)}...`);

    const response = await axios.post<CalComBookingResponse>(
      `${calComUrl}/bookings`,
      bookingPayload,
      {
        headers: getAuthHeaders(apiKey, CAL_API_VERSION_BOOKINGS),
        timeout: 15000,
      }
    );

    console.log(`[Cal.com] Booking created successfully:`, response.data);

    const booking = response.data?.data;
    return {
      success: true,
      eventId: booking?.uid || String(booking?.id ?? ""),
    };
  } catch (error: any) {
    console.error(
      "[Cal.com] Failed to create booking:",
      error.response?.data || error
    );

    if (error.response) {
      const status = error.response.status;
      const errorData = error.response.data;

      console.error(`[Cal.com] API Error ${status}:`, errorData);

      const message =
        errorData?.error?.message ||
        errorData?.message ||
        JSON.stringify(errorData);

      if (status === 400) {
        return {
          success: false,
          error: `Bad Request (400): ${message}`,
        };
      } else if (status === 404) {
        return { success: false, error: "Event type or user not found" };
      } else if (status === 409) {
        return { success: false, error: "Time slot already booked" };
      }

      return { success: false, error: `Cal.com API error (${status}): ${message}` };
    }

    return {
      success: false,
      error: error.message || "Unknown error creating booking",
    };
  }
}

/**
 * Cancel a booking in Cal.com.
 * POST /v2/bookings/:bookingUid/cancel
 * Docs: https://cal.com/docs/api-reference/v2/bookings/cancel-a-booking
 */
export async function cancelCalComBooking(
  bookingUid: string,
  cancellationReason?: string
): Promise<{ success: boolean; error?: string }> {
  const apiKey = process.env.CALCOM_API_KEY;
  const calComUrl = getCalComBaseUrl();

  console.log(`[Cal.com] Cancelling booking ${bookingUid}`);

  if (!apiKey) {
    console.warn("[Cal.com] CALCOM_API_KEY not set, cannot cancel booking");
    return { success: false, error: "API key not configured" };
  }

  try {
    const response = await axios.post(
      `${calComUrl}/bookings/${bookingUid}/cancel`,
      {
        cancellationReason: cancellationReason || "Cancelled by system",
      },
      {
        headers: getAuthHeaders(apiKey, CAL_API_VERSION_BOOKINGS),
        timeout: 10000,
      }
    );

    console.log(`[Cal.com] Booking cancelled successfully:`, bookingUid, response.data);
    return { success: true };
  } catch (error: any) {
    console.error("[Cal.com] Failed to cancel booking:", error.response?.data || error);

    if (error.response) {
      const status = error.response.status;
      if (status === 404) {
        return { success: false, error: "Booking not found" };
      }
      const message =
        error.response.data?.error?.message ||
        error.response.data?.message ||
        error.message;
      return { success: false, error: `Cal.com API error (${status}): ${message}` };
    }

    return {
      success: false,
      error: error.message || "Unknown error cancelling booking",
    };
  }
}
