import { eq, and, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import {
  InsertUser,
  users,
  practitioners,
  bookings,
  InsertBooking,
  type Booking,
  type Practitioner,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;
let _pool: Pool | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _pool = new Pool({
        connectionString: process.env.DATABASE_URL,
      });
      _db = drizzle(_pool);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    // PostgreSQL upsert using ON CONFLICT
    await db
      .insert(users)
      .values(values)
      .onConflictDoUpdate({
        target: users.openId,
        set: {
          ...updateSet,
          updatedAt: sql`NOW()`,
        },
      });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db
    .select()
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getPractitioner(id: number) {
  const db = await getDb();
  if (!db) {
    // Fallback to mock data if database is not available
    console.log("[DB] Database not available, using mock data");
    return getMockPractitioner(id);
  }

  const result = await db
    .select()
    .from(practitioners)
    .where(eq(practitioners.id, id))
    .limit(1);
  const practitioner = result.length > 0 ? result[0] : undefined;

  // If not found in database, try mock data
  if (!practitioner) {
    console.log(
      `[DB] Practitioner ${id} not found in database, using mock data`
    );
    return getMockPractitioner(id);
  }

  return practitioner;
}

function getMockPractitioner(id: number) {
  const mockPractitioners = [
    {
      id: 1,
      name: "Dr. Sarah Johnson",
      email: "sarah@example.com",
      description: "Clinical Psychologist",
      hourlyRate: 8000,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 2,
      name: "Dr. Michael Chen",
      email: "michael@example.com",
      description: "Therapist",
      hourlyRate: 7500,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 3,
      name: "Emma Wilson",
      email: "emma@example.com",
      description: "Counselor",
      hourlyRate: 6000,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  return mockPractitioners.find(p => p.id === id);
}

export async function createBooking(booking: InsertBooking) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(bookings).values(booking).returning();
  return result[0];
}

export async function getBooking(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(bookings)
    .where(eq(bookings.id, id))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateBookingStatus(
  id: number,
  status: "pending" | "confirmed" | "cancelled"
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(bookings)
    .set({
      status,
      updatedAt: sql`NOW()`,
    })
    .where(eq(bookings.id, id));
}

export async function updateBookingWithStripeData(
  id: number,
  stripeSessionId: string,
  stripePaymentIntentId: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(bookings)
    .set({
      stripeSessionId,
      stripePaymentIntentId,
      updatedAt: sql`NOW()`,
    })
    .where(eq(bookings.id, id));
}

export async function getBookingByStripeSessionId(sessionId: string) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(bookings)
    .where(eq(bookings.stripeSessionId, sessionId))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function checkBookingConflict(
  practitionerId: number,
  bookingTime: Date
) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(bookings)
    .where(
      and(
        eq(bookings.practitionerId, practitionerId),
        eq(bookings.bookingTime, bookingTime)
      )
    )
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}
