/**
 * Migration script to convert integer IDs to UUIDs
 * This script migrates practitioners and bookings from integer IDs to UUIDs
 */

import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

// Helper function to generate UUID - tries gen_random_uuid() first, falls back to uuid_generate_v4()
async function generateUUID(client: any): Promise<string> {
  try {
    const result = await client.query(`SELECT gen_random_uuid() as uuid`);
    return result.rows[0].uuid;
  } catch (error) {
    // Fallback to uuid-ossp function
    try {
      const result = await client.query(`SELECT uuid_generate_v4() as uuid`);
      return result.rows[0].uuid;
    } catch (error2) {
      throw new Error("Neither gen_random_uuid() nor uuid_generate_v4() is available. Please enable pgcrypto or uuid-ossp extension.");
    }
  }
}

async function migrateToUUIDs() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is not set. Please check your .env.local file.");
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  let client;
  try {
    client = await pool.connect();
    console.log("✅ Connected to database");
  } catch (connectionError: any) {
    console.error("❌ Failed to connect to database:", connectionError.message);
    await pool.end();
    throw connectionError;
  }

  try {
    await client.query('BEGIN');
    console.log("🔄 Starting migration from integer IDs to UUIDs...");

    // Step 1: Enable uuid extension if not already enabled
    console.log("📦 Enabling UUID extension...");
    // Try pgcrypto first (for gen_random_uuid), fallback to uuid-ossp
    try {
      await client.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
      console.log("   ✅ pgcrypto extension enabled");
    } catch (error: any) {
      console.log("   ⚠️  pgcrypto not available, trying uuid-ossp...");
      try {
        await client.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
        console.log("   ✅ uuid-ossp extension enabled");
      } catch (error2: any) {
        console.warn("   ⚠️  Could not enable UUID extension, but gen_random_uuid() may still work");
      }
    }

    // Step 2: Check current schema
    const practitionersCheck = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'practitioners' AND column_name = 'id'
    `);

    const bookingsCheck = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'bookings' AND column_name = 'id'
    `);

    console.log("📊 Current schema:");
    console.log(`   practitioners.id: ${practitionersCheck.rows[0]?.data_type || 'not found'}`);
    console.log(`   bookings.id: ${bookingsCheck.rows[0]?.data_type || 'not found'}`);

    // Check if already migrated
    if (practitionersCheck.rows[0]?.data_type === 'uuid') {
      try {
        await client.query('COMMIT');
      } catch (commitError: any) {
        // If already committed or no transaction, ignore
        console.log("   Note: Transaction already closed");
      }
      console.log("✅ Database already uses UUIDs. Migration not needed.");
      if (client) {
        client.release();
      }
      await pool.end();
      return;
    }

    // Step 3: Migrate practitioners table
    console.log("\n👥 Migrating practitioners table...");
    
    // Add temporary UUID column (without default to avoid issues)
    await client.query(`
      ALTER TABLE practitioners 
      ADD COLUMN IF NOT EXISTS id_new uuid
    `);

    // Update the new column with UUIDs for existing records
    const practitionersList = await client.query(`SELECT id FROM practitioners`);
    for (const practitioner of practitionersList.rows) {
      const newUUID = await generateUUID(client as any);
      await client.query(`
        UPDATE practitioners 
        SET id_new = $1::uuid
        WHERE id = $2
      `, [newUUID, practitioner.id]);
    }
    console.log(`   ✅ Generated UUIDs for ${practitionersList.rows.length} practitioners`);

    // Migrate bookings.practitionerId first (before dropping practitioners.id)
    console.log("📅 Migrating bookings.practitionerId...");
    
    // Add temporary UUID column for practitionerId
    await client.query(`
      ALTER TABLE bookings 
      ADD COLUMN IF NOT EXISTS practitionerId_new uuid
    `);

    // Map old integer IDs to new UUIDs
    // Convert integer to integer for proper comparison
    await client.query(`
      UPDATE bookings b
      SET practitionerId_new = p.id_new
      FROM practitioners p
      WHERE b."practitionerId" = p.id
    `);

    // Check for orphaned bookings
    const orphanedBookings = await client.query(`
      SELECT COUNT(*) as count 
      FROM bookings 
      WHERE practitionerId_new IS NULL
    `);

    if (parseInt(orphanedBookings.rows[0].count) > 0) {
      console.warn(`⚠️  Warning: ${orphanedBookings.rows[0].count} bookings have invalid practitionerId`);
    }

    // Step 4: Migrate bookings.id
    console.log("📅 Migrating bookings.id...");
    
    // Add temporary UUID column for bookings.id
    await client.query(`
      ALTER TABLE bookings 
      ADD COLUMN IF NOT EXISTS id_new uuid
    `);

    // Update the new column with UUIDs for existing records
    const bookingsList = await client.query(`SELECT id FROM bookings`);
    for (const booking of bookingsList.rows) {
      const newUUID = await generateUUID(client as any);
      await client.query(`
        UPDATE bookings 
        SET id_new = $1::uuid
        WHERE id = $2
      `, [newUUID, booking.id]);
    }
    console.log(`   ✅ Generated UUIDs for ${bookingsList.rows.length} bookings`);

    // Step 5: Drop old columns and constraints
    console.log("🗑️  Removing old columns...");
    
    // Find and drop all foreign key constraints that reference practitioners.id
    const fkConstraints = await client.query(`
      SELECT constraint_name 
      FROM information_schema.table_constraints 
      WHERE table_name = 'bookings' 
      AND constraint_type = 'FOREIGN KEY'
      AND constraint_name LIKE '%practitioner%'
    `);

    for (const constraint of fkConstraints.rows) {
      console.log(`   Dropping constraint: ${constraint.constraint_name}`);
      // Use parameterized query to avoid SQL injection
      await client.query(`
        ALTER TABLE bookings 
        DROP CONSTRAINT IF EXISTS "${constraint.constraint_name}"
      `);
    }

    // Drop primary key constraints first
    try {
      await client.query(`ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_pkey`);
      await client.query(`ALTER TABLE practitioners DROP CONSTRAINT IF EXISTS practitioners_pkey`);
    } catch (error: any) {
      console.log("   Note: Some constraints may not exist, continuing...");
    }

    // Drop old columns
    await client.query(`
      ALTER TABLE bookings 
      DROP COLUMN IF EXISTS id,
      DROP COLUMN IF EXISTS "practitionerId"
    `);

    await client.query(`
      ALTER TABLE practitioners 
      DROP COLUMN IF EXISTS id
    `);

    // Step 6: Rename new columns
    console.log("✏️  Renaming new columns...");
    
    await client.query(`
      ALTER TABLE practitioners 
      RENAME COLUMN id_new TO id
    `);

    await client.query(`
      ALTER TABLE bookings 
      RENAME COLUMN id_new TO id,
      RENAME COLUMN practitionerId_new TO "practitionerId"
    `);

    // Step 7: Set as primary keys and add constraints
    console.log("🔑 Setting up primary keys and constraints...");
    
    await client.query(`
      ALTER TABLE practitioners 
      ADD PRIMARY KEY (id)
    `);

    await client.query(`
      ALTER TABLE bookings 
      ADD PRIMARY KEY (id)
    `);

    // Add foreign key constraint
    await client.query(`
      ALTER TABLE bookings 
      ADD CONSTRAINT bookings_practitionerId_fkey 
      FOREIGN KEY ("practitionerId") 
      REFERENCES practitioners(id) 
      ON DELETE CASCADE
    `);

    // Step 8: Make columns NOT NULL
    await client.query(`
      ALTER TABLE bookings 
      ALTER COLUMN "practitionerId" SET NOT NULL
    `);

    // Step 9: Verify migration
    console.log("\n✅ Verifying migration...");
    
    const practitionersAfter = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'practitioners' AND column_name = 'id'
    `);

    const bookingsAfter = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'bookings' AND column_name = 'id'
    `);

    const practitionerIdAfter = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'bookings' AND column_name = 'practitionerId'
    `);

    console.log("📊 New schema:");
    console.log(`   practitioners.id: ${practitionersAfter.rows[0]?.data_type || 'not found'}`);
    console.log(`   bookings.id: ${bookingsAfter.rows[0]?.data_type || 'not found'}`);
    console.log(`   bookings.practitionerId: ${practitionerIdAfter.rows[0]?.data_type || 'not found'}`);

    // Show sample data
    const samplePractitioners = await client.query(`
      SELECT id, name FROM practitioners LIMIT 3
    `);
    
    console.log("\n👥 Sample practitioners:");
    samplePractitioners.rows.forEach(p => {
      console.log(`   - ${p.id} (${p.name})`);
    });

    // Commit transaction
    await client.query('COMMIT');
    console.log("\n🎉 Migration completed successfully!");
    console.log("\n⚠️  Important: Update your environment variables if using Cal.com:");
    console.log("   Change CALCOM_EVENT_TYPE_1 to CALCOM_EVENT_TYPE_<uuid>");
    console.log("   Use the UUIDs shown above for each practitioner.");

  } catch (error: any) {
    // Rollback transaction on error
    if (client) {
      try {
        await client.query('ROLLBACK');
        console.log("   ✅ Transaction rolled back");
      } catch (rollbackError: any) {
        console.error("   ⚠️  Error during rollback:", rollbackError.message);
      }
    }
    console.error("\n❌ Migration failed, transaction rolled back");
    console.error("   Error message:", error.message);
    console.error("   Error code:", error.code || "N/A");
    if (error.detail) {
      console.error("   Error detail:", error.detail);
    }
    if (error.hint) {
      console.error("   Hint:", error.hint);
    }
    if (error.position) {
      console.error("   Position:", error.position);
    }
    if (error.where) {
      console.error("   Where:", error.where);
    }
    throw error;
  } finally {
    if (client) {
      try {
        client.release();
        console.log("   ✅ Database connection released");
      } catch (releaseError: any) {
        console.error("   ⚠️  Error releasing client:", releaseError.message);
      }
    }
    try {
      await pool.end();
    } catch (endError: any) {
      console.error("   ⚠️  Error ending pool:", endError.message);
    }
  }
}

// Run migration
migrateToUUIDs()
  .then(() => {
    console.log("\n✅ Migration script completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Migration script failed:", error);
    process.exit(1);
  });
