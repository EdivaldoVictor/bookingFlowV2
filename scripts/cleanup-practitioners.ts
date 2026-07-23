import dotenv from "dotenv";
import { Pool } from "pg";

dotenv.config({ path: ".env.local" });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function main() {
  const targetId = process.env.PRACTITIONER_BISPO_UUID || "550e8400-e29b-41d4-a716-446655440421";

  try {
    const client = await pool.connect();

    await client.query(`
      CREATE TABLE IF NOT EXISTS practitioners (
        id uuid PRIMARY KEY,
        name varchar(255) NOT NULL,
        email varchar(320) NOT NULL,
        description text,
        "hourlyRate" integer NOT NULL,
        "createdAt" timestamp DEFAULT now() NOT NULL,
        "updatedAt" timestamp DEFAULT now() NOT NULL
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS bookings (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "practitionerId" uuid NOT NULL,
        "clientName" varchar(255) NOT NULL,
        "clientEmail" varchar(320) NOT NULL,
        "clientPhone" varchar(20) NOT NULL,
        "bookingTime" timestamp NOT NULL,
        status varchar(20) DEFAULT 'pending' NOT NULL,
        "stripeSessionId" varchar(255),
        "stripePaymentIntentId" varchar(255),
        amount integer NOT NULL,
        "createdAt" timestamp DEFAULT now() NOT NULL,
        "updatedAt" timestamp DEFAULT now() NOT NULL,
        CONSTRAINT bookings_practitionerId_fkey
          FOREIGN KEY ("practitionerId") REFERENCES practitioners(id) ON DELETE CASCADE
      )
    `);

    const existing = await client.query(`
      SELECT id, name FROM practitioners ORDER BY name
    `);

    const keepName = "Bispo barber";
    const rows = existing.rows;

    for (const practitioner of rows) {
      if (practitioner.name === keepName && practitioner.id === targetId) {
        continue;
      }

      await client.query(`
        DELETE FROM practitioners WHERE id = $1::uuid
      `, [practitioner.id]);
    }

    await client.query(`
      INSERT INTO practitioners (id, name, email, description, "hourlyRate", "createdAt", "updatedAt")
      VALUES ($1::uuid, $2, $3, $4, $5, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        email = EXCLUDED.email,
        description = EXCLUDED.description,
        "hourlyRate" = EXCLUDED."hourlyRate",
        "updatedAt" = NOW()
    `, [targetId, keepName, "bispo@example.com", "Barber", 6000]);

    const finalRows = await client.query(`
      SELECT id, name, email, description, "hourlyRate" FROM practitioners ORDER BY name
    `);

    console.log("✅ Practitioners after cleanup:");
    for (const row of finalRows.rows) {
      console.log(`- ${row.name} (${row.id})`);
    }
  } catch (error) {
    console.error("❌ Error cleaning practitioners:", error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
