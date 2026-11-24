// Job rules (DB §7 "jobs", §10 "One running job per project", API §11). The API creates,
// lists, cancels and retries jobs; Inngest functions move them through their steps with the
// step helpers below. Every step write is conditional on `status: 'running'`, so a step that
// runs late after a cancel changes nothing, and finished jobs never change again.
import { isJobFinished, type ListJobsQuery } from "@vidcosmos/spec/api";
import { jobEventId } from "@vidcosmos/spec/events";
import type { Job, Workspace } from "@vidcosmos/spec/collections";
import { type Db, type Filter, ObjectId } from "mongodb";
import type { Owner } from "./projects.ts";
import { JobError } from "./job-error.ts";
import { systemCollection, workspaceCollection } from "./scoped.ts";
import { releaseVideo } from "./usage.ts";

export { JobError, type JobErrorCode } from "./job-error.ts";

/** Finished jobs are kept 180 days, then a TTL index removes them (DB §7). */
export const jobRetentionDays = 180;

/** Which job a step works on; the Inngest event carries both. */
export type JobRef = { workspaceId: ObjectId; jobId: ObjectId };

const jobs = (db: Db) => workspaceCollection(db, "jobs");
const projects = (db: Db) => workspaceCollection(db, "projects");
const active = { $in: ["queued", "running"] as Job["status"][] };

const notFound = () => new JobError("NOT_FOUND", "That job doesn't exist.");

/** A route parameter as a job id; anything else can't exist. */
export function parseJobId(value: string): ObjectId {
  if (!/^[0-9a-f]{24}$/.test(value)) throw notFound();
  return new ObjectId(value);
}

export async function getJob(db: Db, workspaceId: ObjectId, jobId: ObjectId): Promise<Job> {
  const job = await jobs(db).findOne({ workspaceId, _id: jobId });
  if (!job) throw notFound();
  return job;
}

// ---- Create ----

/**
 * Claims the project for one job (DB §10). The job is inserted before its claim, and rollbacks
 * free the project before deleting the job, so a claim whose job is finished or missing really
 * is left over: it's cleared and claimed again. The stuck-job sweeper (F35) does the same for
 * jobs that died while running.
 */
async function claimProject(db: Db, workspaceId: ObjectId, projectId: ObjectId, jobId: ObjectId) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const claimed = await projects(db).updateOne(
      { workspaceId, _id: projectId, deletedAt: null, activeJobId: null },
      { $set: { activeJobId: jobId } },
    );
    if (claimed.matchedCount === 1) return;
    const project = await projects(db).findOne(
      { workspaceId, _id: projectId, deletedAt: null },
      { projection: { activeJobId: 1 } },
    );
    if (!project) throw new JobError("NOT_FOUND", "That video doesn't exist.");
    const holder = project.activeJobId;
    if (!holder) continue; // released in the meantime
    const holding = await jobs(db).findOne(
      { workspaceId, _id: holder },
      { projection: { status: 1 } },
    );
    if (holding && !isJobFinished(holding.status)) {
      throw new JobError("JOB_IN_PROGRESS", "Something is already running on this video.", {
        jobId: holder.toHexString(),
      });
    }
    await projects(db).updateOne(
      { workspaceId, _id: projectId, activeJobId: holder },
      { $set: { activeJobId: null } },
    );
  }
  throw new JobError("JOB_IN_PROGRESS", "Something is already running on this video.");
}

async function releaseProject(db: Db, job: Pick<Job, "_id" | "workspaceId" | "projectId">) {
  if (!job.projectId) return;
  await projects(db).updateOne(
    { workspaceId: job.workspaceId, _id: job.projectId, activeJobId: job._id },
    { $set: { activeJobId: null } },
  );
}

export type NewJob = {
  type: Job["type"];
  projectId: ObjectId | null;
  input: Record<string, unknown>;
  idempotencyKey?: string;
  /** The job uses one of the project's AI requests, given back if it fails (`ideas.ts`). */
  reservesGeneration?: boolean;
  /**
   * A video of the month is reserved for it (a first generation, `generate.ts`): committed
   * when its version is saved, given back if it fails or is cancelled.
   */
  reservesVideo?: boolean;
};

/**
 * A queued job, after the shared checks in API order: the project has no running job (`409
 * JOB_IN_PROGRESS`), then the workspace's concurrent jobs (`403 LIMIT_REACHED`). The caller
 * sends the job's start event with `jobEventId(job id)`.
 */
export async function createJob(
  db: Db,
  owner: Owner,
  workspace: Pick<Workspace, "_id" | "limits">,
  input: NewJob,
  now = new Date(),
): Promise<Job> {
  const jobId = new ObjectId();
  const { workspaceId } = owner;
  const job: Job = {
    _id: jobId,
    schemaVersion: 1,
    workspaceId,
    projectId: input.projectId,
    userId: owner.userId,
    type: input.type,
    status: "queued",
    progress: 0,
    input: input.input,
    ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
    inngest: { eventId: jobEventId(jobId.toHexString()) },
    usage: {
      reserved: Boolean(input.reservesGeneration || input.reservesVideo),
      committed: false,
      released: false,
    },
    attempts: 0,
    createdAt: now,
    updatedAt: now,
  };
  // The job first, then the claim: another request that sees this claim also finds the job
  // (and gets JOB_IN_PROGRESS) instead of taking the claim for a job that seems missing.
  await jobs(db).insertOne(job);
  if (input.projectId) {
    try {
      await claimProject(db, workspaceId, input.projectId, jobId);
    } catch (error) {
      await jobs(db).deleteOne({ workspaceId, _id: jobId });
      throw error;
    }
  }

  // Counted after the insert, so two requests at once can't both take the last slot: at
  // worst both see the other and both are refused.
  const max = workspace.limits.concurrentJobs;
  const running = await jobs(db).countDocuments({ workspaceId, status: active });
  if (running > max) {
    // The claim goes before the job, so no claim is ever left pointing at nothing.
    await releaseProject(db, job);
    await jobs(db).deleteOne({ workspaceId, _id: jobId });
    throw new JobError(
      "LIMIT_REACHED",
      `Up to ${max} videos can be generating or exporting at the same time. Try again when one finishes.`,
      { limit: "concurrentJobs", used: max, max, resetsAt: null },
    );
  }
  return job;
}

// ---- List ----

type Cursor = { v: string; i: string };

function decodeCursor(value: string): { at: Date; id: ObjectId } {
  const invalid = () =>
    new JobError("INVALID_CURSOR", "This page link doesn't work any more. Load the list again.");
  let cursor: Partial<Cursor>;
  try {
    cursor = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<Cursor>;
  } catch {
    throw invalid();
  }
  const at = new Date(String(cursor.v));
  if (Number.isNaN(at.getTime()) || !/^[0-9a-f]{24}$/.test(String(cursor.i))) throw invalid();
  return { at, id: new ObjectId(String(cursor.i)) };
}

/** Recent and running jobs, newest first (API §11 "List"). */
export async function listJobs(
  db: Db,
  workspaceId: ObjectId,
  query: ListJobsQuery,
): Promise<{ items: Job[]; nextCursor: string | null }> {
  const filter: Filter<Job> & { workspaceId: ObjectId } = { workspaceId };
  if (query.active) filter.status = active;
  if (query.projectId) filter.projectId = new ObjectId(query.projectId);
  if (query.cursor) {
    const { at, id } = decodeCursor(query.cursor);
    filter.$or = [{ createdAt: { $lt: at } }, { createdAt: at, _id: { $lt: id } }];
  }
  const rows = await jobs(db)
    .find(filter, { sort: { createdAt: -1, _id: -1 }, limit: query.limit + 1 })
    .toArray();
  const items = rows.slice(0, query.limit);
  const last = items.at(-1);
  const cursor = last && { v: last.createdAt.toISOString(), i: last._id.toHexString() };
  return {
    items,
    nextCursor:
      rows.length > query.limit && cursor
        ? Buffer.from(JSON.stringify(cursor)).toString("base64url")
        : null,
  };
}

// ---- Cancel and retry ----

/**
 * Records a cancel request (API §11 "Cancel"). A queued job stops at once; a running one keeps
 * its status until its run stops at the next step boundary. `signal` says whether the caller
 * should send `job/cancel.requested` to stop the run.
 */
export async function requestCancel(
  db: Db,
  workspaceId: ObjectId,
  jobId: ObjectId,
  now = new Date(),
): Promise<{ job: Job; signal: boolean }> {
  const job = await getJob(db, workspaceId, jobId);
  if (isJobFinished(job.status) || job.type === "account_delete") {
    throw new JobError("NOT_CANCELLABLE", "This can't be stopped any more.", {
      status: job.status,
    });
  }
  const asked = await jobs(db).updateOne(
    { workspaceId, _id: jobId, status: active, cancelRequestedAt: { $exists: false } },
    { $set: { cancelRequestedAt: now, updatedAt: now } },
  );
  // A queued job has no steps to finish: it ends now, and a run that starts later sees it's
  // no longer queued and stops (`startJob`).
  await finishJob(db, { workspaceId, jobId }, { status: "cancelled" }, now, "queued");
  return { job: await getJob(db, workspaceId, jobId), signal: asked.modifiedCount === 1 };
}

/**
 * Runs a failed job again with the same input (API §11 "Retry"): a new job, through the same
 * checks as the first. Only failed and partial jobs whose error is retryable.
 */
export async function retryJob(
  db: Db,
  owner: Owner,
  workspace: Pick<Workspace, "_id" | "limits">,
  jobId: ObjectId,
  now = new Date(),
): Promise<Job> {
  const job = await getJob(db, owner.workspaceId, jobId);
  if ((job.status !== "failed" && job.status !== "partial") || !job.error?.retryable) {
    throw new JobError("NOT_RETRYABLE", "This job can't be tried again.", { status: job.status });
  }
  // A job that used one of the project's AI requests uses another (API §11: the same checks).
  const reserves = job.usage.reserved && job.projectId !== null;
  if (reserves) {
    await reserveGeneration(db, owner, job.projectId!, workspace.limits.generationsPerVideo);
  }
  try {
    return await createJob(
      db,
      owner,
      workspace,
      { type: job.type, projectId: job.projectId, input: job.input, reservesGeneration: reserves },
      now,
    );
  } catch (error) {
    if (reserves) await returnGeneration(db, owner, job.projectId!);
    throw error;
  }
}

// ---- Start events that didn't arrive ----

/** How long a queued job waits before its start event is sent again. */
export const startResendMs = 10_000;

/**
 * Whether to send a queued job's start event again: it never started, nobody asked to stop
 * it, and nothing touched it for `startResendMs`. Claiming bumps `updatedAt`, so callers
 * polling at once (two tabs) send at most one event per interval. Sending again is safe: the
 * event id (`jobEventId`) makes Inngest ignore it once the first one arrived.
 */
export async function claimStartResend(db: Db, ref: JobRef, now = new Date()): Promise<boolean> {
  const claimed = await jobs(db).updateOne(
    {
      workspaceId: ref.workspaceId,
      _id: ref.jobId,
      status: "queued",
      startedAt: { $exists: false },
      cancelRequestedAt: { $exists: false },
      updatedAt: { $lte: new Date(now.getTime() - startResendMs) },
    },
    { $set: { updatedAt: now } },
  );
  return claimed.modifiedCount === 1;
}

// ---- Steps (called from Inngest functions) ----

const notCancelled = { cancelRequestedAt: { $exists: false } };

/**
 * The run's first step: `queued` to `running`. False when the job shouldn't run: it was
 * cancelled, it already finished, or someone asked to stop it.
 */
export async function startJob(
  db: Db,
  ref: JobRef,
  runId: string,
  now = new Date(),
): Promise<boolean> {
  const started = await jobs(db).updateOne(
    { workspaceId: ref.workspaceId, _id: ref.jobId, status: active, ...notCancelled },
    [
      {
        $set: {
          status: "running",
          startedAt: { $ifNull: ["$startedAt", now] },
          heartbeatAt: now,
          updatedAt: now,
          "inngest.runId": { $literal: runId },
          attempts: { $add: ["$attempts", 1] },
        },
      },
    ],
  );
  return started.matchedCount === 1;
}

export type JobProgress = {
  stage?: NonNullable<Job["stage"]>;
  /** 0-100; a lower value than the job already shows is ignored (progress never goes down). */
  progress: number;
  message?: string;
};

/**
 * A step's progress write. False when the job is no longer running or someone asked to stop
 * it: the function then stops (and finishes the job as cancelled).
 */
export async function advanceJob(
  db: Db,
  ref: JobRef,
  update: JobProgress,
  now = new Date(),
): Promise<boolean> {
  const progress = Math.min(100, Math.max(0, update.progress));
  const advanced = await jobs(db).updateOne(
    { workspaceId: ref.workspaceId, _id: ref.jobId, status: "running", ...notCancelled },
    [
      {
        $set: {
          progress: { $max: ["$progress", progress] },
          heartbeatAt: now,
          updatedAt: now,
          ...(update.stage ? { stage: { $literal: update.stage } } : {}),
          ...(update.message !== undefined ? { message: { $literal: update.message } } : {}),
        },
      },
    ],
  );
  return advanced.matchedCount === 1;
}

type JobScene = NonNullable<Job["scenes"]>[number];

/**
 * The scenes a narration job works on, each with its status (API §11), for the generating
 * screen. Written while the job runs; a later call replaces the list (a retried run).
 */
export async function setJobScenes(
  db: Db,
  ref: JobRef,
  scenes: Pick<JobScene, "sceneId" | "status">[],
  now = new Date(),
): Promise<boolean> {
  const set = await jobs(db).updateOne(
    { workspaceId: ref.workspaceId, _id: ref.jobId, status: "running" },
    {
      $set: {
        scenes: scenes.map((scene) => ({ ...scene, attempts: 0 })),
        heartbeatAt: now,
        updatedAt: now,
      },
    },
  );
  return set.matchedCount === 1;
}

/** One scene's status, attempts and error while the job runs. */
export async function markJobScene(
  db: Db,
  ref: JobRef,
  sceneId: string,
  update: Pick<JobScene, "status"> & Partial<Pick<JobScene, "attempts" | "error">>,
  now = new Date(),
): Promise<boolean> {
  const marked = await jobs(db).updateOne(
    { workspaceId: ref.workspaceId, _id: ref.jobId, status: "running", "scenes.sceneId": sceneId },
    {
      $set: {
        "scenes.$.status": update.status,
        ...(update.attempts !== undefined ? { "scenes.$.attempts": update.attempts } : {}),
        ...(update.error ? { "scenes.$.error": update.error } : {}),
        heartbeatAt: now,
        updatedAt: now,
      },
    },
  );
  return marked.matchedCount === 1;
}

/**
 * Jobs that stopped responding (SDD §8 "Timeouts"): running with no progress for 15 minutes,
 * or queued that long with no run. The stuck-job cron fails them, which releases their usage.
 */
export async function findStuckJobs(
  db: Db,
  now = new Date(),
  quietMs = stuckAfterMs,
): Promise<JobRef[]> {
  const before = new Date(now.getTime() - quietMs);
  const stuck = await systemCollection(db, "jobs")
    .find(
      {
        $or: [
          { status: "running", heartbeatAt: { $lt: before } },
          { status: "queued", updatedAt: { $lt: before } },
        ],
      },
      { projection: { workspaceId: 1 }, limit: 200 },
    )
    .toArray();
  return stuck.map((job) => ({ workspaceId: job.workspaceId, jobId: job._id }));
}

/** No progress for this long and a job counts as stuck. */
export const stuckAfterMs = 15 * 60_000;

/** Whether someone asked the job to stop. */
export async function cancelRequested(db: Db, ref: JobRef): Promise<boolean> {
  const job = await jobs(db).findOne(
    { workspaceId: ref.workspaceId, _id: ref.jobId },
    { projection: { status: 1, cancelRequestedAt: 1 } },
  );
  return !job || Boolean(job.cancelRequestedAt) || isJobFinished(job.status);
}

export type JobOutcome =
  | { status: "succeeded" | "partial"; result?: Record<string, unknown> }
  | { status: "failed"; error: NonNullable<Job["error"]> }
  | { status: "cancelled" };

/**
 * Ends the job and frees its project (with a filter on `activeJobId: jobId`, so a newer job's
 * claim stays). Repeating it changes nothing: a finished job keeps its first outcome, and the
 * project is freed again in case the earlier attempt stopped half-way.
 */
export async function finishJob(
  db: Db,
  ref: JobRef,
  outcome: JobOutcome,
  now = new Date(),
  from: "queued" | "active" = "active",
): Promise<Job | null> {
  const set: Record<string, unknown> = {
    status: outcome.status,
    finishedAt: now,
    expiresAt: new Date(now.getTime() + jobRetentionDays * 86_400_000),
    updatedAt: now,
  };
  if (outcome.status === "succeeded" || outcome.status === "partial") {
    set.progress = 100;
    if (outcome.result) set.result = outcome.result;
  }
  if (outcome.status === "failed") set.error = outcome.error;

  const filter = {
    workspaceId: ref.workspaceId,
    _id: ref.jobId,
    status: from === "queued" ? ("queued" as const) : active,
  };
  const finished =
    (await jobs(db).findOneAndUpdate(filter, { $set: set }, { returnDocument: "after" })) ??
    (await jobs(db).findOne({ workspaceId: ref.workspaceId, _id: ref.jobId }));
  if (finished && isJobFinished(finished.status)) {
    await releaseProject(db, finished);
    await settleGeneration(db, finished);
  }
  return finished;
}

// ---- AI requests used by jobs (API §6) ----

/** Uses one AI request on the project, or refuses with `403 LIMIT_REACHED`. */
export async function reserveGeneration(
  db: Db,
  owner: { workspaceId: ObjectId },
  projectId: ObjectId,
  max: number,
): Promise<void> {
  const reserved = await projects(db).updateOne(
    {
      workspaceId: owner.workspaceId,
      _id: projectId,
      deletedAt: null,
      generationsUsed: { $lt: max },
    },
    { $inc: { generationsUsed: 1 } },
  );
  if (reserved.matchedCount === 1) return;
  const project = await projects(db).findOne(
    { workspaceId: owner.workspaceId, _id: projectId, deletedAt: null },
    { projection: { generationsUsed: 1 } },
  );
  if (!project) throw new JobError("NOT_FOUND", "That video doesn't exist.");
  throw new JobError("LIMIT_REACHED", `This video has used all ${max} of its AI requests.`, {
    limit: "generationsPerVideo",
    used: project.generationsUsed,
    max,
    resetsAt: null,
  });
}

/** Gives an AI request back to the project (the job that would have used it never started). */
export async function returnGeneration(
  db: Db,
  owner: { workspaceId: ObjectId },
  projectId: ObjectId,
): Promise<void> {
  await projects(db).updateOne(
    { workspaceId: owner.workspaceId, _id: projectId, generationsUsed: { $gt: 0 } },
    { $inc: { generationsUsed: -1 } },
  );
}

/**
 * A failed or cancelled job gives its AI request back. Repeating it (Inngest steps may run
 * more than once) changes nothing; a job that succeeded keeps it.
 */
export async function releaseJobGeneration(db: Db, ref: JobRef): Promise<boolean> {
  const released = await jobs(db).findOneAndUpdate(
    {
      workspaceId: ref.workspaceId,
      _id: ref.jobId,
      "usage.reserved": true,
      "usage.committed": false,
      "usage.released": false,
    },
    { $set: { "usage.released": true } },
    { projection: { projectId: 1 } },
  );
  if (!released?.projectId) return false;
  await returnGeneration(db, ref, released.projectId);
  return true;
}

/**
 * Removes a job that was created but must not run (a later check refused the request), and
 * frees its project first, so no claim points at a missing job.
 */
export async function discardJob(db: Db, job: Pick<Job, "_id" | "workspaceId" | "projectId">) {
  await releaseProject(db, job);
  await jobs(db).deleteOne({ workspaceId: job.workspaceId, _id: job._id });
}

/** The project's stage before a generation started, kept in the job's input. */
const stageBefore = (job: Job) => (job.input.stageBefore === "ready" ? "ready" : "draft");

/**
 * Settles a generation that ended without saving: the video reserved for it is given back
 * once (the save already committed it if it saved), and the project returns to the stage it
 * had: `draft` for a first generation, `ready` on its previous version.
 */
async function settleVideo(db: Db, job: Job) {
  if (job.status === "succeeded" || job.status === "partial") return;
  if (job.projectId) {
    await projects(db).updateOne(
      { workspaceId: job.workspaceId, _id: job.projectId, stage: "generating" },
      { $set: { stage: stageBefore(job) } },
    );
  }
  if (!job.usage.reserved) return;
  const released = await jobs(db).updateOne(
    {
      workspaceId: job.workspaceId,
      _id: job._id,
      "usage.committed": false,
      "usage.released": false,
    },
    { $set: { "usage.released": true } },
  );
  if (released.modifiedCount === 1) await releaseVideo(db, job.workspaceId);
}

/** Settles a finished job's AI request: kept when it succeeded, given back otherwise. */
async function settleGeneration(db: Db, job: Job) {
  if (job.type === "generate") return settleVideo(db, job);
  if (!job.usage.reserved) return;
  const ref = { workspaceId: job.workspaceId, jobId: job._id };
  if (job.status === "succeeded" || job.status === "partial") {
    await jobs(db).updateOne(
      { workspaceId: job.workspaceId, _id: job._id, "usage.released": false },
      { $set: { "usage.committed": true } },
    );
  } else {
    await releaseJobGeneration(db, ref);
  }
}
