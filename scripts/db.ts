import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { practitioners } from "../drizzle/schema";
import { getAvailabilityForPractitioner } from "../server/services/availability";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const practitionersData = [
  {
    name: "Dr. Sarah Johnson",
    email: "sarah@example.com",
    description: "Clinical Psychologist",
    hourlyRate: 8000, // £80
  },
  {
    name: "Dr. Michael Chen",
    email: "michael@example.com",
    description: "Therapist",
    hourlyRate: 7500, // £75
  },
  {
    name: "Emma Wilson",
    email: "emma@example.com",
    description: "Counselor",
    hourlyRate: 6000, // £60
  },
];

const setupDatabase = async () => {
  console.log("🚀 Setting up database schema...");

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    // Drop existing tables if they exist
    console.log("📝 Dropping existing tables...");
    await pool.query(`
      DROP TABLE IF EXISTS bookings CASCADE;
      DROP TABLE IF EXISTS practitioners CASCADE;
      DROP TABLE IF EXISTS users CASCADE;
      DROP TYPE IF EXISTS role CASCADE;
      DROP TYPE IF EXISTS status CASCADE;
    `);

    console.log("🏗️ Creating schema...");
    // Create enums
    await pool.query(`CREATE TYPE "role" AS ENUM('user', 'admin')`);
    await pool.query(`CREATE TYPE "status" AS ENUM('pending', 'confirmed', 'cancelled')`);

    // Create tables
    await pool.query(`
      CREATE TABLE "bookings" (
        "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
        "practitionerId" integer NOT NULL,
        "clientName" varchar(255) NOT NULL,
        "clientEmail" varchar(320) NOT NULL,
        "clientPhone" varchar(20) NOT NULL,
        "bookingTime" timestamp NOT NULL,
        "status" "status" DEFAULT 'pending' NOT NULL,
        "stripeSessionId" varchar(255),
        "stripePaymentIntentId" varchar(255),
        "amount" integer NOT NULL,
        "createdAt" timestamp DEFAULT now() NOT NULL,
        "updatedAt" timestamp DEFAULT now() NOT NULL
      )
    `);

    await pool.query(`
      CREATE TABLE "practitioners" (
        "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
        "name" varchar(255) NOT NULL,
        "email" varchar(320) NOT NULL,
        "description" text,
        "hourlyRate" integer NOT NULL,
        "createdAt" timestamp DEFAULT now() NOT NULL,
        "updatedAt" timestamp DEFAULT now() NOT NULL
      )
    `);

    await pool.query(`
      CREATE TABLE "users" (
        "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
        "openId" varchar(64) NOT NULL UNIQUE,
        "name" text,
        "email" varchar(320),
        "loginMethod" varchar(64),
        "role" "role" DEFAULT 'user' NOT NULL,
        "createdAt" timestamp DEFAULT now() NOT NULL,
        "updatedAt" timestamp DEFAULT now() NOT NULL,
        "lastSignedIn" timestamp DEFAULT now() NOT NULL
      )
    `);

    console.log("✅ Database schema created successfully");
  } catch (error) {
    console.error("❌ Error setting up database:", error);
    throw error;
  } finally {
    await pool.end();
  }
};

const seedDatabase = async () => {
  console.log("🌱 Seeding database...");

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    const db = drizzle(pool);

    // Check if practitioners already exist
    const existing = await db.select().from(practitioners);
    console.log(`📊 Found ${existing.length} existing practitioners`);

    if (existing.length === 0) {
      // Insert practitioners
      console.log("💾 Inserting practitioners...");
      await db.insert(practitioners).values(practitionersData);
      console.log("✅ Practitioners seeded successfully");
    } else {
      console.log("⏭️ Practitioners already exist, skipping seed");
    }

    // Show final count
    const finalCount = await db.select().from(practitioners);
    console.log(`📈 Total practitioners in database: ${finalCount.length}`);

  } catch (error) {
    console.error("❌ Error seeding database:", error);
    throw error;
  } finally {
    await pool.end();
  }
};

const testDatabase = async () => {
  console.log("🧪 Testing database and API...");

  try {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
    const db = drizzle(pool);

    // Test database connection
    const practitionersList = await db.select().from(practitioners);
    console.log(`✅ Found ${practitionersList.length} practitioners in database`);

    if (practitionersList.length > 0) {
      console.log("👥 Practitioners:");
      practitionersList.forEach(p => {
        console.log(`   - ID: ${p.id}, Name: ${p.name}, Email: ${p.email}`);
      });

      // Test availability service
      console.log("\n📅 Testing availability service...");
      const practitionerId = practitionersList[0].id;
      console.log(`Testing availability for practitioner ID: ${practitionerId}`);

      const slots = await getAvailabilityForPractitioner(practitionerId);
      console.log(`✅ Got ${slots.length} availability slots`);

      // Show first few slots
      console.log("📋 First 3 slots:");
      slots.slice(0, 3).forEach(slot => {
        console.log(
          `   - ${slot.startTime.toLocaleDateString()} ${slot.startTime.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})} (${slot.available ? "Available" : "Busy"})`
        );
      });
    }

    await pool.end();
    console.log("\n🎉 All tests passed!");
  } catch (error) {
    console.error("❌ Test failed:", error);
    throw error;
  }
};

const main = async () => {
  const command = process.argv[2] || 'all';

  try {
    switch (command) {
      case 'setup':
        await setupDatabase();
        break;
      case 'seed':
        await seedDatabase();
        break;
      case 'test':
        await testDatabase();
        break;
      case 'all':
      default:
        await setupDatabase();
        await seedDatabase();
        await testDatabase();
        break;
    }

    console.log("\n🎯 Database operation completed successfully!");
  } catch (error) {
    console.error("\n💥 Database operation failed:", error);
    process.exit(1);
  }
};

main();
