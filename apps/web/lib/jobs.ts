// Starting and signalling jobs from route handlers (API §11, SDD §8). The job document is
// written first; then its start event goes to Inngest. If sending fails (Inngest unreachable),
// the job stays queued, and `resendIfWaiting` sends the event again when the job is next read
// or its request replayed, at most every 10 s. The event id stops a second run.
import "server-only";
import { claimStartResend, getJob, type Owner } from "@vidcosmos/db";
import { type JobDto, toJobDto } from "@vidcosmos/spec/api";
import type { Job } from "@vidcosmos/spec/collections";
import { demoJobMode, requestIdeasInput } from "@vidcosmos/spec/api";
import { jobEventId } from "@vidcosmos/spec/events";
import {
  demoJobRequested,
  ideasRequested,
  jobCancelRequested,
  scriptRequested,
  scriptRewriteRequested,
} from "@/inngest/events";
import { inngest } from "@/inngest/client";
import { getDb } from "./db";

type Sendable = Parameters<typeof inngest.send>[0];

async function send(event: Sendable, what: string): Promise<boolean> {
  try {
    await inngest.send(event);
    return true;
  } catch (error) {
    console.error(`[jobs] Couldn't send ${what} to Inngest`, error);
    return false;
  }
}

/** The event that runs a job of this type. Each job type joins this with its function. */
function startEvent(job: Job) {
  const data = {
    workspaceId: job.workspaceId.toHexString(),
    projectId: job.projectId?.toHexString() ?? null,
    jobId: job._id.toHexString(),
  };
  const options = { id: jobEventId(data.jobId) };
  switch (job.type) {
    case "demo":
      return demoJobRequested.create({ ...data, mode: demoJobMode.parse(job.input.mode) }, options);
    case "ideas": {
      const input = requestIdeasInput.parse(job.input);
      return ideasRequested.create(
        {
          ...data,
          projectId: data.projectId!,
          count: input.count,
          ...(input.steer ? { steer: input.steer } : {}),
        },
        options,
      );
    }
    case "script":
      return scriptRequested.create({ ...data, projectId: data.projectId! }, options);
    case "script_rewrite":
      return scriptRewriteRequested.create({ ...data, projectId: data.projectId! }, options);
    default:
      throw new Error(`No function runs ${job.type} jobs yet.`);
  }
}

/** Sends a new job's start event. Sending the same job twice starts one run (the event id). */
export async function sendStart(job: Job): Promise<boolean> {
  let event: ReturnType<typeof startEvent>;
  try {
    event = startEvent(job);
  } catch (error) {
    // A bug, not an outage: the job stays queued (cancel frees it) rather than failing the
    // request after the job was already created.
    console.error(`[jobs] Couldn't build the start of job ${job._id.toHexString()}`, error);
    return false;
  }
  return send(event, `the start of job ${job._id.toHexString()}`);
}

/**
 * Sends the start event again for a job that is still waiting for its run: queued, never
 * started, not cancelled, untouched for 10 s. Called wherever a job is read or replayed.
 */
export async function resendIfWaiting(job: Job, now = new Date()): Promise<void> {
  if (job.status !== "queued" || job.startedAt || job.cancelRequestedAt) return;
  const ref = { workspaceId: job.workspaceId, jobId: job._id };
  if (await claimStartResend(getDb(), ref, now)) await sendStart(job);
}

/** Asks Inngest to stop the job's run at the next step boundary. */
export function sendCancel(job: Job): Promise<boolean> {
  return send(
    jobCancelRequested.create({
      workspaceId: job.workspaceId.toHexString(),
      jobId: job._id.toHexString(),
    }),
    `the cancel of job ${job._id.toHexString()}`,
  );
}

/** `202 Accepted` with the job and where to poll it (API §1, "Background work"). */
export function accepted(job: JobDto, replayed = false): Response {
  const headers = new Headers({ Location: `/api/v1/jobs/${job.id}` });
  if (replayed) headers.set("Idempotent-Replayed", "true");
  return Response.json(job, { status: 202, headers });
}

/**
 * After an idempotent create: a new job's start event goes out; a replay sends it again if the
 * job is still waiting. Then `202` with the stored job.
 */
export async function startedResponse(owner: Owner, jobId: Job["_id"], replayed: boolean) {
  const job = await getJob(getDb(), owner.workspaceId, jobId);
  if (replayed) await resendIfWaiting(job);
  else await sendStart(job);
  return accepted(toJobDto(job), replayed);
}
