// Route protection before a page renders (Next.js proxy, formerly middleware). This only
// checks that a session cookie is present, which is fast; pages still verify the session
// with `requireSession`, so a forged or expired cookie gets no further than the layout.
//
// Signed-in visitors on /sign-in are sent on by the page itself, after a real session
// check: doing it here on the cookie alone would loop with an expired cookie.
import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";
import { isProtectedPath, requestPathHeader, signInPath } from "@/lib/auth-routes";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const params = new URLSearchParams(request.nextUrl.search);
  params.delete("_rsc"); // Next.js's own marker for client navigations, not part of the page
  const path = pathname + (params.size ? `?${params}` : "");

  if (isProtectedPath(pathname) && !getSessionCookie(request)) {
    return NextResponse.redirect(new URL(signInPath(path), request.url));
  }
  // Pages can't see their own URL in a layout; this header tells the app layout which page was
  // asked for (to come back to it after onboarding). Set here on every request, so a value
  // sent by the browser never gets through.
  const headers = new Headers(request.headers);
  headers.set(requestPathHeader, path);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: [
    "/library/:path*",
    "/onboarding/:path*",
    "/projects/:path*",
    "/posts/:path*",
    "/settings/:path*",
    "/admin/:path*",
  ],
};
