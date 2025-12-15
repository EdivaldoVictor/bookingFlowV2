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

export async function getPractitioner(id: string) {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const result = await db
    .select()
    .from(practitioners)
    .where(eq(practitioners.id, id))
    .limit(1);
  const practitioner = result.length > 0 ? result[0] : undefined;

  // If not found in database, return error
  if (!practitioner) {
    throw new Error(`Practitioner ${id} not found in database`);
  }

  return practitioner;
}

export async function createBooking(booking: InsertBooking) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  try {
    console.log("[DB] Creating booking with data:", {
      practitionerId: booking.practitionerId,
      clientName: booking.clientName,
      clientEmail: booking.clientEmail,
      clientPhone: booking.clientPhone,
      bookingTime: booking.bookingTime,
      status: booking.status,
      amount: booking.amount,
      stripeSessionId: booking.stripeSessionId || null,
      stripePaymentIntentId: booking.stripePaymentIntentId || null,
    });

    const result = await db.insert(bookings).values(booking).returning();
    
    if (!result || result.length === 0) {
      throw new Error("Failed to create booking: no result returned");
    }
    
    console.log("[DB] Booking created successfully:", result[0].id);
    return result[0];
  } catch (error: any) {
    console.error("[DB] Error creating booking:", error);
    console.error("[DB] Error message:", error.message);
    console.error("[DB] Error code:", error.code);
    if (error.detail) {
      console.error("[DB] Error detail:", error.detail);
    }
    if (error.hint) {
      console.error("[DB] Error hint:", error.hint);
    }
    throw error;
  }
}

export async function getBooking(id: string) {
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
  id: string,
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
  id: string,
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
  practitionerId: string,
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
