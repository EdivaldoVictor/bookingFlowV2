import type { PublicUser, User } from "../../drizzle/schema";

/** Strip secrets before returning a user over the API. */
export function toPublicUser(user: User): PublicUser {
  const { passwordHash: _passwordHash, ...publicUser } = user;
  return publicUser;
}
