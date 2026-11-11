// Route protection before a page renders (Next.js proxy, formerly middleware). This only
// checks that a session cookie is present, which is fast; pages still verify the session
// with `requireSession`, so a forged or expired cookie gets no further than the layout.
//
// Signed-in visitors on /sign-in are sent on by the page itself, after a real session
// check: doing it here on the cookie alone would loop with an expired cookie.
import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";
import { isProtectedPath, signInPath } from "@/lib/auth-routes";

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (isProtectedPath(pathname) && !getSessionCookie(request)) {
    return NextResponse.redirect(new URL(signInPath(pathname + search), request.url));
  }
  return NextResponse.next();
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
