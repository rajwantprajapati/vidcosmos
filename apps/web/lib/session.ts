// Server-side session helpers for pages and route handlers.
import "server-only";
import { ensureWorkspace, ObjectId } from "@vidcosmos/db";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "./auth";
import { getDb } from "./db";
import { signInPath } from "./auth-routes";

/** The current session, or null. Cached for the duration of one request. */
export const getSession = cache(async () => auth.api.getSession({ headers: await headers() }));

/**
 * The signed-in user and their workspace. Redirects to sign-in when there is no session,
 * coming back to `returnTo` afterwards.
 */
export const requireSession = cache(async (returnTo: string) => {
  const session = await getSession();
  if (!session) redirect(signInPath(returnTo));
  const workspace = await ensureWorkspace(getDb(), {
    id: new ObjectId(session.user.id),
    name: session.user.name,
  });
  return { ...session, workspace };
});
