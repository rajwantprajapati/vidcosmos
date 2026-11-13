// When Inngest stops a run because of `cancelOn` (API §11 "Cancel"), the job's own steps don't
// run again, so this function ends the job as `cancelled` and frees its project. Inngest sends
// `inngest/function.cancelled` with the run's triggering event in `data.event`; runs that
// weren't started by a job event are ignored.
import { jobEventData } from "@vidcosmos/spec/events";
import type { Inngest } from "inngest";
import { z } from "zod";
import type { JobStore } from "../job-store";

const cancelledRun = z.object({ data: z.object({ event: z.object({ data: jobEventData }) }) });

export function createJobCancelled(inngest: Inngest, store: JobStore) {
  return inngest.createFunction(
    {
      id: "job-cancelled",
      name: "Mark a cancelled job",
      triggers: [{ event: "inngest/function.cancelled" }],
      retries: 3,
    },
    async ({ event, step }) => {
      const parsed = cancelledRun.safeParse(event);
      if (!parsed.success) return { outcome: "ignored" as const };
      const job = parsed.data.data.event.data;
      await step.run("mark-cancelled", () => store.finish(job, { status: "cancelled" }));
      return { outcome: "cancelled" as const };
    },
  );
}
