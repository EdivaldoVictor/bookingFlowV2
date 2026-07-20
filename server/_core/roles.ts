import { ENV } from "./env";

export type AppRole = "user" | "admin";

/**
 * Returns true when the email is listed in ADMIN_EMAILS (comma-separated env).
 */
export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return ENV.adminEmails.includes(email.trim().toLowerCase());
}

/**
 * Resolves the effective role for a user.
 * Admin comes from:
 * - explicit role already stored as admin
 * - OWNER_OPEN_ID match
 * - ADMIN_EMAILS environment list
 */
export function resolveUserRole(user: {
  role?: string | null;
  email?: string | null;
  openId?: string | null;
}): AppRole {
  if (user.role === "admin") return "admin";
  if (user.openId && ENV.ownerOpenId && user.openId === ENV.ownerOpenId) {
    return "admin";
  }
  if (isAdminEmail(user.email)) return "admin";
  return "user";
}
