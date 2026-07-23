import { Pool } from "pg";
import dotenv from "dotenv";
import { hashPassword } from "../server/_core/password";
import { ENV } from "../server/_core/env";

dotenv.config({ path: ".env.local" });

const ADMIN_EMAIL = ENV.adminEmail;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "welcome22@@";
const ADMIN_NAME = "Admin";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required (.env.local)");
  }

  const pool = new Pool({ connectionString });

  try {
    console.log("Checking users table columns...");
    const columns = await pool.query<{ column_name: string }>(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'users'
       ORDER BY ordinal_position`
    );
    const columnNames = columns.rows.map((row) => row.column_name);
    console.log(`  columns: ${columnNames.join(", ")}`);

    if (!columnNames.includes("passwordHash")) {
      console.log('Adding missing column "passwordHash"...');
      await pool.query(`ALTER TABLE "users" ADD COLUMN "passwordHash" text`);
      console.log("  done");
    } else {
      console.log('  "passwordHash" already exists');
    }

    const normalizedEmail = ADMIN_EMAIL.trim().toLowerCase();
    const openId = `local:${normalizedEmail}`;
    const passwordHash = await hashPassword(ADMIN_PASSWORD);

    const existing = await pool.query<{ id: number; email: string | null; role: string }>(
      `SELECT id, email, role FROM users WHERE email = $1 LIMIT 1`,
      [normalizedEmail]
    );

    if (existing.rows.length === 0) {
      console.log(`Creating admin user ${normalizedEmail}...`);
      await pool.query(
        `INSERT INTO users ("openId", name, email, "passwordHash", "loginMethod", role, "lastSignedIn")
         VALUES ($1, $2, $3, $4, 'local', 'admin', NOW())`,
        [openId, ADMIN_NAME, normalizedEmail, passwordHash]
      );
      console.log("  admin user created");
    } else {
      console.log(`Updating admin user ${normalizedEmail}...`);
      await pool.query(
        `UPDATE users
         SET name = $2,
             "openId" = $3,
             "passwordHash" = $4,
             "loginMethod" = 'local',
             role = 'admin',
             "lastSignedIn" = NOW(),
             "updatedAt" = NOW()
         WHERE email = $1`,
        [normalizedEmail, ADMIN_NAME, openId, passwordHash]
      );
      console.log("  admin user updated");
    }

    const verify = await pool.query<{
      id: number;
      email: string | null;
      role: string;
      loginMethod: string | null;
      hasPassword: boolean;
    }>(
      `SELECT id, email, role, "loginMethod",
              ("passwordHash" IS NOT NULL AND "passwordHash" <> '') AS "hasPassword"
       FROM users
       WHERE email = $1`,
      [normalizedEmail]
    );

    console.log("\nAdmin account status:");
    console.log(verify.rows[0]);
    console.log("\nLogin with:");
    console.log(`  email: ${normalizedEmail}`);
    console.log(`  password: ${ADMIN_PASSWORD}`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("fix-auth-db failed:", error);
  process.exit(1);
});
