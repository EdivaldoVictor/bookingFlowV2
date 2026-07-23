import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { practitioners } from "../drizzle/schema";
import { getAvailabilityForPractitioner } from "../server/services/availability";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const practitionersData = [
  {
    id: process.env.PRACTITIONER_BISPO_UUID as string,
    name: "Bispo barber",
    email: "bispo@example.com",
    description: "Barber",
    hourlyRate: 4500, // R$ 45.00
  },
];

const setupDatabase = async () => {
  console.log("🚀 Setting up database schema...");

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log("🏗️ Creating schema (if not exists)...");

    // Enable UUID extension
    try {
      await pool.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
      console.log("   ✅ pgcrypto extension enabled");
    } catch (error: any) {
      console.log("   ⚠️  pgcrypto not available, trying uuid-ossp...");
      try {
        await pool.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
        console.log("   ✅ uuid-ossp extension enabled");
      } catch (error2: any) {
        console.warn("   ⚠️  Could not enable UUID extension, but gen_random_uuid() may still work");
      }
    }
    
    // Create enums if they don't exist
    const roleExists = await pool.query(`SELECT 1 FROM pg_type WHERE typname = 'role'`);
    if (roleExists.rows.length === 0) {
      await pool.query(`CREATE TYPE "role" AS ENUM('user', 'admin')`);
      console.log("   ✅ role enum created");
    }
    
    const statusExists = await pool.query(`SELECT 1 FROM pg_type WHERE typname = 'status'`);
    if (statusExists.rows.length === 0) {
      await pool.query(`CREATE TYPE "status" AS ENUM('pending', 'confirmed', 'cancelled')`);
      console.log("   ✅ status enum created");
    }

    // Create tables with UUIDs
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "practitioners" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" varchar(255) NOT NULL,
        "email" varchar(320) NOT NULL,
        "description" text,
        "hourlyRate" integer NOT NULL,
        "createdAt" timestamp DEFAULT now() NOT NULL,
        "updatedAt" timestamp DEFAULT now() NOT NULL
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS "bookings" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "practitionerId" uuid NOT NULL,
        "clientName" varchar(255) NOT NULL,
        "clientEmail" varchar(320) NOT NULL,
        "clientPhone" varchar(20) NOT NULL,
        "bookingTime" timestamp NOT NULL,
        "status" "status" DEFAULT 'pending' NOT NULL,
        "stripeSessionId" varchar(255),
        "stripePaymentIntentId" varchar(255),
        "amount" integer NOT NULL,
        "createdAt" timestamp DEFAULT now() NOT NULL,
        "updatedAt" timestamp DEFAULT now() NOT NULL,
        CONSTRAINT "bookings_practitionerId_fkey" 
          FOREIGN KEY ("practitionerId") 
          REFERENCES practitioners(id) 
          ON DELETE CASCADE
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
        "openId" varchar(64) NOT NULL UNIQUE,
        "name" text,
        "email" varchar(320),
        "passwordHash" text,
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

const seedAdminUser = async (pool: Pool) => {
  const { hashPassword } = await import("../server/_core/password");
  const { ENV } = await import("../server/_core/env");

  const normalizedEmail = ENV.adminEmail.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "welcome22@@";
  const openId = `local:${normalizedEmail}`;
  const passwordHash = await hashPassword(password);

  const existing = await pool.query(
    `SELECT id FROM users WHERE email = $1 LIMIT 1`,
    [normalizedEmail]
  );

  if (existing.rows.length === 0) {
    console.log(`👤 Creating admin user ${normalizedEmail}...`);
    await pool.query(
      `INSERT INTO users ("openId", name, email, "passwordHash", "loginMethod", role, "lastSignedIn")
       VALUES ($1, $2, $3, $4, 'local', 'admin', NOW())`,
      [openId, "Admin", normalizedEmail, passwordHash]
    );
  } else {
    await pool.query(
      `UPDATE users
       SET "openId" = $2,
           "passwordHash" = $3,
           "loginMethod" = 'local',
           role = 'admin',
           "updatedAt" = NOW()
       WHERE email = $1`,
      [normalizedEmail, openId, passwordHash]
    );
    console.log(`👤 Admin user ${normalizedEmail} password synced`);
  }
};

const ensurePasswordHashColumn = async (pool: Pool) => {
  const columns = await pool.query<{ column_name: string }>(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'users'`
  );
  const names = columns.rows.map((row) => row.column_name);
  if (!names.includes("passwordHash")) {
    console.log('📝 Adding missing column "passwordHash" to users...');
    await pool.query(`ALTER TABLE "users" ADD COLUMN "passwordHash" text`);
  }
};

const seedDatabase = async () => {
  console.log("🌱 Seeding database...");

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await ensurePasswordHashColumn(pool);
    const db = drizzle(pool);

    // Check if practitioners already exist
    const existing = await db.select().from(practitioners);
    console.log(`📊 Found ${existing.length} existing practitioners`);

    if (existing.length === 0) {
      // Insert practitioners with fixed UUIDs
      console.log("💾 Inserting practitioners with fixed UUIDs...");
      await db.insert(practitioners).values(practitionersData);
      console.log("✅ Practitioners seeded successfully");
      console.log("\n📋 Practitioner UUIDs (use these for CALCOM_EVENT_TYPE):");
      practitionersData.forEach(p => {
        console.log(`   - ${p.name}: ${p.id}`);
      });

    } else {
      console.log("⏭️ Practitioners already exist");
      console.log("📋 Existing practitioner UUIDs:");
      existing.forEach(p => {
        console.log(`   - ${p.name}: ${p.id}`);
      });
      
      // Check if we need to update UUIDs to fixed ones
      console.log("\n🔄 Checking if UUIDs need to be updated to fixed values...");
      
      try {
        // Update each practitioner to use fixed UUID if they don't match
        for (let i = 0; i < Math.min(existing.length, practitionersData.length); i++) {
          const existingP = existing[i];
          const fixedP = practitionersData[i];
          
          if (existingP.id !== fixedP.id) {
            console.log(`   ⚠️  Practitioner "${existingP.name}" has UUID ${existingP.id}, updating to ${fixedP.id}...`);
            
            // First, update any bookings that reference this practitioner
            await pool.query(`
              UPDATE bookings 
              SET "practitionerId" = $1::uuid
              WHERE "practitionerId" = $2::uuid
            `, [fixedP.id, existingP.id]);
            
            // Then update the practitioner
            await pool.query(`
              UPDATE practitioners 
              SET id = $1::uuid
              WHERE id = $2::uuid
            `, [fixedP.id, existingP.id]);
            
            console.log(`   ✅ Updated "${existingP.name}" to use fixed UUID ${fixedP.id}`);
          } else {
            console.log(`   ✅ "${existingP.name}" already has correct UUID ${fixedP.id}`);
          }
        }
        
        // If there are more practitioners than expected, leave them as is
        if (existing.length > practitionersData.length) {
          console.log(`   ℹ️  Found ${existing.length - practitionersData.length} additional practitioners, leaving as is`);
        }
      } catch (error: any) {
        console.error("   ❌ Error updating UUIDs:", error.message);
        // Don't throw - this is not critical
      }
      
      console.log("\n💡 Current UUIDs for CALCOM_EVENT_TYPE configuration:");
     

      existing.forEach(p => {
        const uuidNoHyphens = p.id.replace(/-/g, '');
        console.log(`   CALCOM_EVENT_TYPE_${uuidNoHyphens}=<event_type_id>  # For ${p.name}`);
      });
    }

    // Show final count
    const finalCount = await db.select().from(practitioners);
    console.log(`\n📈 Total practitioners in database: ${finalCount.length}`);

    await seedAdminUser(pool);

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
      // Ensure practitionerId is a string (UUID)
      const practitionerIdStr = typeof practitionerId === 'string' ? practitionerId : String(practitionerId);
      console.log(`Testing availability for practitioner ID: ${practitionerIdStr}`);

      const slots = await getAvailabilityForPractitioner(practitionerIdStr);
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
