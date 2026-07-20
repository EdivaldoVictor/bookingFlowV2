export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Generate login URL at runtime so redirect URI reflects the current origin.
export const getLoginUrl = (redirectTo?: string) => {
  const redirectUri = `${window.location.origin}/api/oauth/callback`;
  const state = btoa(redirectUri);

  const portalUrl = (
    import.meta.env.VITE_OAUTH_PORTAL_URL || window.location.origin
  ).trim();

  const normalizedBaseUrl = /^https?:\/\//i.test(portalUrl)
    ? portalUrl
    : `https://${portalUrl}`;

  const url = new URL("/api/oauth/callback", normalizedBaseUrl);
  url.searchParams.set("code", "local-dev-code");
  url.searchParams.set("state", state);

  if (redirectTo) {
    url.searchParams.set("redirectTo", redirectTo);
  }

  return url.toString();
};
