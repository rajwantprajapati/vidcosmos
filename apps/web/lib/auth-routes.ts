// Where auth sends people, shared by the proxy, pages and forms.

/** Pages that need a session (the app). Everything under them is protected too. */
export const protectedPrefixes = [
  "/library",
  "/onboarding",
  "/projects",
  "/posts",
  "/settings",
  "/admin",
] as const;

export const appHome = "/library";

/** Request header the proxy sets to the page asked for (path and query). */
export const requestPathHeader = "x-vidcosmos-path";

const matchesPrefix = (pathname: string, prefix: string) =>
  pathname === prefix || pathname.startsWith(`${prefix}/`);

export const isProtectedPath = (pathname: string) =>
  protectedPrefixes.some((prefix) => matchesPrefix(pathname, prefix));

/**
 * A safe place to return to after signing in: an app path on this site only. Anything else
 * (a full URL, `//host`, a backslash trick) falls back to the app home.
 */
export function safeReturnTo(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return appHome;
  }
  return value;
}

export function signInPath(returnTo?: string): string {
  const next = safeReturnTo(returnTo);
  return next === appHome ? "/sign-in" : `/sign-in?next=${encodeURIComponent(next)}`;
}

/** Onboarding, coming back to `returnTo` afterwards (or the library). */
export function onboardingPath(returnTo?: string | null): string {
  const next = safeReturnTo(returnTo);
  return next === appHome ? "/onboarding" : `/onboarding?next=${encodeURIComponent(next)}`;
}
