import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);

/**
 * Hash a password with a random salt using scrypt.
 * Stored format: `<saltHex>:<hashHex>`
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

/**
 * Verify a plain password against a stored scrypt hash.
 */
export async function verifyPassword(
  password: string,
  storedHash?: string | null
): Promise<boolean> {
  if (!storedHash) return false;

  const [salt, keyHex] = storedHash.split(":");
  if (!salt || !keyHex) return false;

  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  const key = Buffer.from(keyHex, "hex");
  if (key.length !== derived.length) return false;

  return timingSafeEqual(derived, key);
}
