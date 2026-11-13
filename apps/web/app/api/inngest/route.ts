// Inngest calls this route to find the app's functions and to run their steps (SDD §8).
// Requests are signed with INNGEST_SIGNING_KEY in production; the local Dev Server needs none.
import { serve } from "inngest/next";
import { functions, inngest } from "@/inngest";

// A step may run for up to 300 s (SDD §8 "Timeouts").
export const maxDuration = 300;

export const { GET, POST, PUT } = serve({ client: inngest, functions });
