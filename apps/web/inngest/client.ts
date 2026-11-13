// The Inngest client (SDD §8). Without a signing key, the SDK talks to the local Inngest Dev
// Server on http://localhost:8288 (`pnpm inngest`); with one, to Inngest Cloud.
import "server-only";
import { Inngest } from "inngest";
import { env } from "@/env";

export const inngest = new Inngest({
  id: "vidcosmos",
  isDev: !env.INNGEST_SIGNING_KEY,
  eventKey: env.INNGEST_EVENT_KEY,
  signingKey: env.INNGEST_SIGNING_KEY,
});
