// Inngest events (SDD §5 "Events"): the data each one carries, as zod schemas. The app turns
// these into Inngest event types in `apps/web/inngest/events.ts`; this package stays free of
// the Inngest SDK. Every job event carries `{ workspaceId, projectId, jobId }` as hex strings.
// Events for later features join this file with their functions.
import { z } from "zod";
import { demoJobMode } from "./api/jobs.ts";

const id = z.string().regex(/^[0-9a-f]{24}$/);

export const jobEventData = z.object({
  workspaceId: id,
  projectId: id.nullable(),
  jobId: id,
});
export type JobEventData = z.infer<typeof jobEventData>;

export const eventSchemas = {
  /** Development only: the demo job with fake steps (F11). */
  "job/demo.requested": jobEventData.extend({ mode: demoJobMode }),
  /** Suggest angles for the project's topic (API §6, `suggestIdeas`). */
  "video/ideas.requested": jobEventData.extend({
    projectId: id,
    count: z.int().min(3).max(5),
    steer: z.string().max(200).optional(),
  }),
  /**
   * Write the script (API §6, `writeScript`). Ids only: the function reads the job's input
   * (angle, instructions) from MongoDB (API §15).
   */
  "video/script.requested": jobEventData.extend({ projectId: id }),
  /** Rewrite all or part of the script (API §6). Ids only, like the script event. */
  "video/script.rewrite.requested": jobEventData.extend({ projectId: id }),
  /** Stops the job's run at the next step boundary (API §11 "Cancel"). */
  "job/cancel.requested": z.object({ workspaceId: id, jobId: id }),
} as const;

export type EventName = keyof typeof eventSchemas;
export type EventData<N extends EventName> = z.infer<(typeof eventSchemas)[N]>;

/**
 * The event id for a job's start event. Inngest ignores a second event with the same id for
 * 24 hours, so sending it again after a network error can't start a second run.
 */
export const jobEventId = (jobId: string) => `job-${jobId}`;
