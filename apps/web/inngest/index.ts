// Every Inngest function the app serves at /api/inngest, wired to the real job store.
import "server-only";
import { getDb } from "@/lib/db";
import { inngest } from "./client";
import { createDemoJob } from "./functions/demo-job";
import { createJobCancelled } from "./functions/job-cancelled";
import { mongoJobStore } from "./job-store";

const store = mongoJobStore(getDb);

export const functions = [
  createDemoJob(inngest, store, { pause: "1s" }),
  createJobCancelled(inngest, store),
];

export { inngest };
