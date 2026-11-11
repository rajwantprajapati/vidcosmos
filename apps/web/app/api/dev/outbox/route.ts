// Development only: the emails the stub "sent", newest first, so a developer or an
// end-to-end test can open a verification or reset link. 404 in production.
import { stubOutbox } from "@vidcosmos/integrations";
import { notFound } from "next/navigation";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  if (process.env.NODE_ENV === "production") notFound();
  const to = request.nextUrl.searchParams.get("to") ?? undefined;
  return Response.json({ messages: stubOutbox.list(to) });
}
