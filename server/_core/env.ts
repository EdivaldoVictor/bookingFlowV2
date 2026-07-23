function parseAdminEmails(): string[] {
  const fromList = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map(value => value.trim().toLowerCase())
    .filter(Boolean);

  const primary = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  if (primary && !fromList.includes(primary)) {
    fromList.unshift(primary);
  }

  return fromList;
}

export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  /** Primary admin account email (seeded on boot). */
  adminEmail: (process.env.ADMIN_EMAIL ?? "haillothere@gmail.com").trim().toLowerCase(),
  /** Primary admin password used only for seeding/updating the admin user. */
  adminPassword: process.env.ADMIN_PASSWORD ?? "welcome22@@",
  adminEmails: parseAdminEmails(),
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
};
