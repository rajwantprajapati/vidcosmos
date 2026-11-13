// Job rules (DB §7 "jobs", §10 "One running job per project", API §11). The API creates,
// lists, cancels and retries jobs; Inngest functions move them through their steps with the
// step helpers below. Every step write is conditional on `status: 'running'`, so a step that
// runs late after a cancel changes nothing, and finished jobs never change again.
import { isJobFinished, type ListJobsQuery } from "@vidcosmos/spec/api";
import { jobEventId } from "@vidcosmos/spec/events";
import type { Job, Workspace } from "@vidcosmos/spec/collections";
import { type Db, type Filter, ObjectId } from "mongodb";
import type { Owner } from "./projects.ts";
import { workspaceCollection } from "./scoped.ts";

export type JobErrorCode =
  | "NOT_FOUND"
  | "INVALID_CURSOR"
  | "JOB_IN_PROGRESS"
  | "LIMIT_REACHED"
  | "NOT_CANCELLABLE"
  | "NOT_RETRYABLE";

/** A refusal the API turns into its error envelope (API §2). */
export class JobError extends Error {
  readonly code: JobErrorCode;
  readonly details?: Record<string, unknown>;
  constructor(code: JobErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "JobError";
    this.code = code;
    this.details = details;
  }
}

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
 * Claims the project for one job (DB §10). A claim left behind by a job that already finished
 * (or no longer exists) is cleared and claimed again; the stuck-job sweeper (F35) does the
 * same for jobs that died while running.
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
  if (input.projectId) await claimProject(db, workspaceId, input.projectId, jobId);

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
    usage: { reserved: false, committed: false, released: false },
    attempts: 0,
    createdAt: now,
    updatedAt: now,
  };
  try {
    await jobs(db).insertOne(job);
  } catch (error) {
    await releaseProject(db, job);
    throw error;
  }

  // Counted after the insert, so two requests at once can't both take the last slot: at
  // worst both see the other and both are refused.
  const max = workspace.limits.concurrentJobs;
  const running = await jobs(db).countDocuments({ workspaceId, status: active });
  if (running > max) {
    await jobs(db).deleteOne({ workspaceId, _id: jobId });
    await releaseProject(db, job);
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
  return createJob(
    db,
    owner,
    workspace,
    { type: job.type, projectId: job.projectId, input: job.input },
    now,
  );
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
  if (finished && isJobFinished(finished.status)) await releaseProject(db, finished);
  return finished;
}
