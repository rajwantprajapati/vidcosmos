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

/** Any control character or whitespace, which browsers strip or reject in URLs. */
const unsafeCharacters =
  /[\u0000-\u0020\u007F-\u00A0\u1680\u2000-\u200F\u2028\u2029\u202F\u205F\u3000\uFEFF]/;

/**
 * A safe place to return to after signing in or onboarding: a path on this site only.
 * Anything else falls back to the app home, including `//host`, full URLs, backslashes, and
 * control characters or spaces (a browser drops a tab from "/<tab>/host", leaving "//host").
 * The value is also resolved as a URL and must stay on the same origin as a plain path.
 */
export function safeReturnTo(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return appHome;
  if (value.includes("\\") || unsafeCharacters.test(value)) return appHome;
  const base = "https://vidcosmos.invalid";
  let url: URL;
  try {
    url = new URL(value, base);
  } catch {
    return appHome;
  }
  if (url.origin !== base || url.pathname.startsWith("//")) return appHome;
  return url.pathname + url.search + url.hash;
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
