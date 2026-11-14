// F11: jobs against MongoDB. One running job per project (409 JOB_IN_PROGRESS), the
// concurrent-jobs limit, ownership, conditional step writes, monotonic progress, cancel,
// retry, the list and its cursor, and that finishing frees the project.
import { createProjectInput, jobDto, listJobsQuery, toJobDto } from "@vidcosmos/spec/api";
import type { Workspace } from "@vidcosmos/spec/collections";
import { ObjectId } from "mongodb";
import { beforeAll, describe, expect, it } from "vitest";
import {
  advanceJob,
  cancelRequested,
  claimStartResend,
  createJob,
  finishJob,
  getJob,
  JobError,
  listJobs,
  type NewJob,
  requestCancel,
  retryJob,
  startJob,
  startResendMs,
} from "./jobs.ts";
import { migrate } from "./migrate.ts";
import { createProject, getProject, type Owner } from "./projects.ts";
import { workspaceCollection } from "./scoped.ts";
import { useTestDatabase } from "./testing/database.ts";
import { ensureWorkspace } from "./workspaces.ts";

const database = useTestDatabase();
const db = () => database.get();

beforeAll(async () => {
  await migrate(db());
});

type TestOwner = Owner & { workspace: Workspace };

async function newOwner(): Promise<TestOwner> {
  const userId = new ObjectId();
  const workspace = await ensureWorkspace(db(), { id: userId, name: "Asha Rao" });
  return { userId, workspaceId: workspace._id, workspace };
}

const newProject = (owner: TestOwner) =>
  createProject(db(), owner, owner.workspace, createProjectInput.parse({ topic: "How UPI works" }));

const demo = (projectId: ObjectId | null, input = {}): NewJob => ({
  type: "demo",
  projectId,
  input: { mode: "succeed", ...input },
});

const ref = (owner: Owner, jobId: ObjectId) => ({ workspaceId: owner.workspaceId, jobId });

async function refused(promise: Promise<unknown>, code: string) {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(JobError);
  expect((error as JobError).code).toBe(code);
  return error as JobError;
}

describe("creating jobs", () => {
  it("queues a job, claims the project and maps to the API shape", async () => {
    const owner = await newOwner();
    const project = await newProject(owner);
    const job = await createJob(db(), owner, owner.workspace, demo(project._id));

    expect(job).toMatchObject({ status: "queued", progress: 0, type: "demo", attempts: 0 });
    expect(job.inngest.eventId).toBe(`job-${job._id.toHexString()}`);
    expect((await getProject(db(), owner.workspaceId, project._id)).activeJobId).toEqual(job._id);

    const dto = jobDto.parse(toJobDto(job));
    expect(dto).toMatchObject({ status: "queued", cancellable: true, stage: null, error: null });
    expect(dto).not.toHaveProperty("input");
    expect(dto).not.toHaveProperty("workspaceId");
  });

  it("refuses a second job on the same project with the running job's id", async () => {
    const owner = await newOwner();
    const project = await newProject(owner);
    const first = await createJob(db(), owner, owner.workspace, demo(project._id));
    const error = await refused(
      createJob(db(), owner, owner.workspace, demo(project._id)),
      "JOB_IN_PROGRESS",
    );
    expect(error.details).toEqual({ jobId: first._id.toHexString() });
  });

  it("lets only one of two parallel starts on one project through", async () => {
    // Many pairs, so an unlucky interleaving shows up here rather than only on CI.
    const owner = await newOwner();
    owner.workspace.limits.concurrentJobs = 100;
    for (let round = 0; round < 25; round++) {
      const project = await newProject(owner);
      const results = await Promise.allSettled([
        createJob(db(), owner, owner.workspace, demo(project._id)),
        createJob(db(), owner, owner.workspace, demo(project._id)),
      ]);
      const started = results.filter((r) => r.status === "fulfilled");
      expect(started, `round ${round}`).toHaveLength(1);
      const rejected = results.find((r) => r.status === "rejected");
      expect((rejected?.reason as JobError).code).toBe("JOB_IN_PROGRESS");
      // The refused job wasn't kept, and the claim is the started job's.
      const kept = await listJobs(
        db(),
        owner.workspaceId,
        listJobsQuery.parse({ projectId: project._id.toHexString() }),
      );
      expect(kept.items.map((j) => j._id)).toEqual([started[0]!.value._id]);
      expect((await getProject(db(), owner.workspaceId, project._id)).activeJobId).toEqual(
        started[0]!.value._id,
      );
    }
  });

  it("clears a claim left by a job that already finished", async () => {
    const owner = await newOwner();
    const project = await newProject(owner);
    const old = await createJob(db(), owner, owner.workspace, demo(project._id));
    // As if the job finished but the step that frees the project never ran.
    await workspaceCollection(db(), "jobs").updateOne(
      { workspaceId: owner.workspaceId, _id: old._id },
      { $set: { status: "failed" } },
    );
    const next = await createJob(db(), owner, owner.workspace, demo(project._id));
    expect((await getProject(db(), owner.workspaceId, project._id)).activeJobId).toEqual(next._id);
  });

  it("refuses another workspace's project as not found", async () => {
    const owner = await newOwner();
    const stranger = await newOwner();
    const project = await newProject(owner);
    await refused(createJob(db(), stranger, stranger.workspace, demo(project._id)), "NOT_FOUND");
  });

  it("refuses a job over the concurrent-jobs limit and keeps nothing", async () => {
    const owner = await newOwner(); // limit 2
    const [a, b, c] = await Promise.all([newProject(owner), newProject(owner), newProject(owner)]);
    await createJob(db(), owner, owner.workspace, demo(a._id));
    await createJob(db(), owner, owner.workspace, demo(b._id));
    const error = await refused(
      createJob(db(), owner, owner.workspace, demo(c._id)),
      "LIMIT_REACHED",
    );
    expect(error.details).toMatchObject({ limit: "concurrentJobs", max: 2 });
    expect((await getProject(db(), owner.workspaceId, c._id)).activeJobId).toBeNull();
    const all = await listJobs(db(), owner.workspaceId, listJobsQuery.parse({}));
    expect(all.items).toHaveLength(2);
  });
});

describe("steps", () => {
  it("runs, keeps progress monotonic, then succeeds and frees the project", async () => {
    const owner = await newOwner();
    const project = await newProject(owner);
    const job = await createJob(db(), owner, owner.workspace, demo(project._id));
    const at = ref(owner, job._id);

    expect(await startJob(db(), at, "run-1")).toBe(true);
    expect(await advanceJob(db(), at, { stage: "llm", progress: 40, message: "Writing" })).toBe(
      true,
    );
    // A late, lower value from a retried step doesn't move progress back.
    expect(await advanceJob(db(), at, { progress: 20 })).toBe(true);
    let saved = await getJob(db(), owner.workspaceId, job._id);
    expect(saved).toMatchObject({ status: "running", stage: "llm", progress: 40, attempts: 1 });
    expect(saved.inngest.runId).toBe("run-1");
    expect(saved.startedAt).toBeInstanceOf(Date);

    const now = new Date("2026-11-12T06:00:00Z");
    await finishJob(db(), at, { status: "succeeded", result: { type: "demo" } }, now);
    saved = await getJob(db(), owner.workspaceId, job._id);
    expect(saved).toMatchObject({ status: "succeeded", progress: 100, result: { type: "demo" } });
    expect(saved.expiresAt).toEqual(new Date("2027-05-11T06:00:00Z"));
    expect((await getProject(db(), owner.workspaceId, project._id)).activeJobId).toBeNull();

    // Finished jobs never change again.
    expect(await advanceJob(db(), at, { progress: 50 })).toBe(false);
    await finishJob(db(), at, { status: "cancelled" });
    expect((await getJob(db(), owner.workspaceId, job._id)).status).toBe("succeeded");
  });

  it("does not free a newer job's claim", async () => {
    const owner = await newOwner();
    const project = await newProject(owner);
    const old = await createJob(db(), owner, owner.workspace, demo(project._id));
    await finishJob(db(), ref(owner, old._id), { status: "failed", error: errorOf(true) });
    const next = await createJob(db(), owner, owner.workspace, demo(project._id));
    // The old job's finish step running again must leave the new claim alone.
    await finishJob(db(), ref(owner, old._id), { status: "failed", error: errorOf(true) });
    expect((await getProject(db(), owner.workspaceId, project._id)).activeJobId).toEqual(next._id);
  });
});

const errorOf = (retryable: boolean) => ({
  code: "INTERNAL",
  message: "Something went wrong. Try again.",
  retryable,
});

describe("cancel", () => {
  it("stops a queued job at once, and its run doesn't start later", async () => {
    const owner = await newOwner();
    const project = await newProject(owner);
    const job = await createJob(db(), owner, owner.workspace, demo(project._id));
    const { job: cancelled, signal } = await requestCancel(db(), owner.workspaceId, job._id);
    expect(signal).toBe(true);
    expect(cancelled.status).toBe("cancelled");
    expect(toJobDto(cancelled).cancellable).toBe(false);
    expect(await startJob(db(), ref(owner, job._id), "run-1")).toBe(false);
    expect((await getProject(db(), owner.workspaceId, project._id)).activeJobId).toBeNull();
  });

  it("asks a running job to stop: steps then refuse to write", async () => {
    const owner = await newOwner();
    const job = await createJob(db(), owner, owner.workspace, demo(null));
    const at = ref(owner, job._id);
    await startJob(db(), at, "run-1");

    const first = await requestCancel(db(), owner.workspaceId, job._id);
    expect(first.signal).toBe(true);
    expect(first.job.status).toBe("running");
    expect(toJobDto(first.job).cancellable).toBe(false);
    expect(await cancelRequested(db(), at)).toBe(true);
    expect(await advanceJob(db(), at, { progress: 60 })).toBe(false);

    // Asking twice is fine and doesn't signal again.
    expect((await requestCancel(db(), owner.workspaceId, job._id)).signal).toBe(false);
  });

  it("refuses finished jobs with their status", async () => {
    const owner = await newOwner();
    const job = await createJob(db(), owner, owner.workspace, demo(null));
    await finishJob(db(), ref(owner, job._id), { status: "succeeded" });
    const error = await refused(requestCancel(db(), owner.workspaceId, job._id), "NOT_CANCELLABLE");
    expect(error.details).toEqual({ status: "succeeded" });
  });

  it("refuses another workspace's job as not found", async () => {
    const owner = await newOwner();
    const stranger = await newOwner();
    const job = await createJob(db(), owner, owner.workspace, demo(null));
    await refused(requestCancel(db(), stranger.workspaceId, job._id), "NOT_FOUND");
    await refused(getJob(db(), stranger.workspaceId, job._id), "NOT_FOUND");
  });
});

describe("retry", () => {
  it("creates a new job with the same input for a retryable failure", async () => {
    const owner = await newOwner();
    const project = await newProject(owner);
    const job = await createJob(db(), owner, owner.workspace, demo(project._id, { mode: "fail" }));
    await finishJob(db(), ref(owner, job._id), { status: "failed", error: errorOf(true) });

    const again = await retryJob(db(), owner, owner.workspace, job._id);
    expect(again._id).not.toEqual(job._id);
    expect(again).toMatchObject({ status: "queued", type: "demo", input: { mode: "fail" } });
    expect((await getProject(db(), owner.workspaceId, project._id)).activeJobId).toEqual(again._id);
  });

  it("refuses jobs that didn't fail, or failed for good", async () => {
    const owner = await newOwner();
    const running = await createJob(db(), owner, owner.workspace, demo(null));
    await refused(retryJob(db(), owner, owner.workspace, running._id), "NOT_RETRYABLE");
    const blocked = await createJob(db(), owner, owner.workspace, demo(null));
    await finishJob(db(), ref(owner, blocked._id), { status: "failed", error: errorOf(false) });
    await refused(retryJob(db(), owner, owner.workspace, blocked._id), "NOT_RETRYABLE");
  });
});

describe("listing", () => {
  it("lists newest first, filters active and by project, and pages with a cursor", async () => {
    const owner = await newOwner();
    const stranger = await newOwner();
    const project = await newProject(owner);
    const ids: ObjectId[] = [];
    for (let i = 0; i < 3; i++) {
      const job = await createJob(
        db(),
        owner,
        owner.workspace,
        demo(i === 0 ? project._id : null),
        new Date(Date.UTC(2026, 10, 12, 6, i)),
      );
      ids.push(job._id);
      if (i < 2) await finishJob(db(), ref(owner, job._id), { status: "succeeded" });
    }
    await createJob(db(), stranger, stranger.workspace, demo(null));

    const first = await listJobs(db(), owner.workspaceId, listJobsQuery.parse({ limit: "2" }));
    expect(first.items.map((j) => j._id)).toEqual([ids[2], ids[1]]);
    expect(first.nextCursor).toBeTruthy();
    const second = await listJobs(
      db(),
      owner.workspaceId,
      listJobsQuery.parse({ limit: "2", cursor: first.nextCursor }),
    );
    expect(second.items.map((j) => j._id)).toEqual([ids[0]]);
    expect(second.nextCursor).toBeNull();

    const running = await listJobs(
      db(),
      owner.workspaceId,
      listJobsQuery.parse({ active: "true" }),
    );
    expect(running.items.map((j) => j._id)).toEqual([ids[2]]);
    const forProject = await listJobs(
      db(),
      owner.workspaceId,
      listJobsQuery.parse({ projectId: project._id.toHexString() }),
    );
    expect(forProject.items.map((j) => j._id)).toEqual([ids[0]]);

    await refused(
      listJobs(db(), owner.workspaceId, listJobsQuery.parse({ cursor: "not-a-cursor" })),
      "INVALID_CURSOR",
    );
  });
});

describe("start events that didn't arrive", () => {
  it("allows one re-send per interval while the job waits, and none once it started", async () => {
    const owner = await newOwner();
    const project = await newProject(owner);
    const created = new Date("2026-11-12T06:00:00Z");
    const job = await createJob(db(), owner, owner.workspace, demo(project._id), created);
    const at = ref(owner, job._id);
    const later = (ms: number) => new Date(created.getTime() + ms);

    expect(await claimStartResend(db(), at, later(startResendMs - 1))).toBe(false);
    // Two pollers at once: one re-send.
    const both = await Promise.all([
      claimStartResend(db(), at, later(startResendMs)),
      claimStartResend(db(), at, later(startResendMs)),
    ]);
    expect(both.filter(Boolean)).toHaveLength(1);
    expect(await claimStartResend(db(), at, later(startResendMs + 1))).toBe(false);
    expect(await claimStartResend(db(), at, later(2 * startResendMs))).toBe(true);

    await startJob(db(), at, "run-1");
    expect(await claimStartResend(db(), at, later(10 * startResendMs))).toBe(false);
  });

  it("doesn't re-send for a job someone asked to stop", async () => {
    const owner = await newOwner();
    const job = await createJob(db(), owner, owner.workspace, demo(null), new Date(0));
    await requestCancel(db(), owner.workspaceId, job._id);
    expect(await claimStartResend(db(), ref(owner, job._id))).toBe(false);
  });
});
