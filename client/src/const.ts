export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Generate login URL at runtime so redirect URI reflects the current origin.
export const getLoginUrl = () => {
  const rawOauthPortalUrl = (
    import.meta.env.VITE_OAUTH_PORTAL_URL || window.location.origin
  ).trim();
  const appId = import.meta.env.VITE_APP_ID || "";
  const redirectUri = `${window.location.origin}/api/oauth/callback`;
  const state = btoa(redirectUri);

  const normalizedBaseUrl = /^https?:\/\//i.test(rawOauthPortalUrl)
    ? rawOauthPortalUrl
    : `https://${rawOauthPortalUrl}`;
  const url = new URL("/app-auth", normalizedBaseUrl);

  if (appId) {
    url.searchParams.set("appId", appId);
  }
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("type", "signIn");

  return url.toString();
};
