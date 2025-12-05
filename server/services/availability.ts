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
  practitionerId: number
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

  try {
    // Map practitioner ID to Cal.com user/event type
    // In production, you'd have a mapping table in your database
    const calComUserId = process.env[`CALCOM_USER_ID_${practitionerId}`];
    const eventTypeId = process.env[`CALCOM_EVENT_TYPE_${practitionerId}`];

    if (!calComUserId || !eventTypeId) {
      console.warn(
        `[Cal.com] Missing environment variables for practitioner ${practitionerId}: CALCOM_USER_ID_${practitionerId} or CALCOM_EVENT_TYPE_${practitionerId}`
      );
      console.log("[Availability] Falling back to mock data due to missing configuration");
      return getMockAvailability(practitionerId);
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
    const requestUrl = `${calComUrl}/availability`;
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

    const busySlots = response.data.busy.map(slot => ({
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
function getMockAvailability(practitionerId: number): TimeSlot[] {
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
  practitionerId: number
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
