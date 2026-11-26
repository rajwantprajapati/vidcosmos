// F20: generating a video against MongoDB. The monthly video is reserved under any number of
// requests at once without going over the limit, and rolls over with the IST month; a request
// is checked in API order; a saved generation writes its version, draft and the video's commit
// together; a failed one gives its video back once and returns the project to its stage.
import { createProjectInput } from "@vidcosmos/spec/api";
import type { Workspace } from "@vidcosmos/spec/collections";
import { exampleScenes, narrationHash, type VideoSpec } from "@vidcosmos/spec/video";
import { testSpec } from "@vidcosmos/spec/video/testing";
import { ObjectId } from "mongodb";
import { beforeAll, describe, expect, it } from "vitest";
import {
  changedSinceVersion,
  readGenerateSnapshot,
  saveGeneratedVersion,
  startGenerate,
  startNarration,
} from "./generate.ts";
import { finishJob, type JobError } from "./jobs.ts";
import { migrate } from "./migrate.ts";
import { createProject, getProject, type Owner, type ProjectError } from "./projects.ts";
import { workspaceCollection } from "./scoped.ts";
import { useTestDatabase } from "./testing/database.ts";
import { releaseVideo, reserveVideo } from "./usage.ts";
import { ensureWorkspace } from "./workspaces.ts";

const database = useTestDatabase();
const db = () => database.get();

beforeAll(async () => {
  await migrate(db());
});

const scenes = [
  exampleScenes.title,
  exampleScenes.flowchart,
  exampleScenes.bullets,
  exampleScenes.recap,
];
const draft = (): VideoSpec => testSpec(scenes);
const holder = "tab-1";
const now = new Date("2026-11-24T10:00:00Z");

const workspaces = () => workspaceCollection(db(), "workspaces");
const projectsOf = () => workspaceCollection(db(), "projects");

async function setup(options: { spec?: VideoSpec | null; limit?: number; used?: number } = {}) {
  const userId = new ObjectId();
  let workspace: Workspace = await ensureWorkspace(db(), { id: userId, name: "Asha Rao" });
  await workspaces().updateOne(
    { _id: workspace._id },
    {
      $set: {
        "limits.videosPerMonth": options.limit ?? 20,
        "usage.periodKey": "2026-11",
        "usage.videosUsed": options.used ?? 0,
        "usage.videosReserved": 0,
      },
    },
  );
  workspace = (await workspaces().findOne({ _id: workspace._id }))!;
  const owner: Owner = { userId, workspaceId: workspace._id };
  const project = await createProject(
    db(),
    owner,
    workspace,
    createProjectInput.parse({ topic: "How UPI works" }),
  );
  const spec = options.spec === undefined ? draft() : options.spec;
  await projectsOf().updateOne(
    { workspaceId: owner.workspaceId, _id: project._id },
    {
      $set: { "draft.spec": spec, wizardStep: "storyboard" },
    },
  );
  return { owner, workspace, projectId: project._id };
}

const usageOf = async (workspaceId: ObjectId) =>
  (await workspaces().findOne({ _id: workspaceId }))!.usage;

describe("reserving a video", () => {
  it("never goes over the limit, whatever arrives at once", async () => {
    const { owner } = await setup({ limit: 5, used: 2 });
    const results = await Promise.allSettled(
      Array.from({ length: 12 }, () => reserveVideo(db(), owner.workspaceId, now)),
    );
    const refused = results.filter((r) => r.status === "rejected");
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(3);
    expect(
      refused.every(
        (r) => (r as PromiseRejectedResult).reason.code === ("LIMIT_REACHED" as JobError["code"]),
      ),
    ).toBe(true);
    expect(await usageOf(owner.workspaceId)).toMatchObject({ videosUsed: 2, videosReserved: 3 });
  });

  it("starts a new IST month with the counters at zero", async () => {
    const { owner } = await setup({ limit: 3, used: 3 });
    await expect(reserveVideo(db(), owner.workspaceId, now)).rejects.toMatchObject({
      code: "LIMIT_REACHED",
      details: { limit: "videosPerMonth", used: 3, max: 3, resetsAt: "2026-11-30T18:30:00.000Z" },
    });
    // 1 Dec in India.
    await reserveVideo(db(), owner.workspaceId, new Date("2026-11-30T19:00:00Z"));
    expect(await usageOf(owner.workspaceId)).toMatchObject({
      periodKey: "2026-12",
      videosUsed: 0,
      videosReserved: 1,
    });
  });

  it("refuses a blocked workspace, and a release never goes below zero", async () => {
    const { owner } = await setup();
    await releaseVideo(db(), owner.workspaceId);
    expect((await usageOf(owner.workspaceId)).videosReserved).toBe(0);
    await workspaces().updateOne({ _id: owner.workspaceId }, { $set: { "flags.blocked": true } });
    await expect(reserveVideo(db(), owner.workspaceId, now)).rejects.toMatchObject({
      code: "WORKSPACE_BLOCKED",
    });
  });
});

describe("starting a generation", () => {
  const start = (s: Awaited<ReturnType<typeof setup>>, baseRev = 0) =>
    startGenerate(db(), s.owner, s.workspace, s.projectId, {
      holder,
      baseRev,
      idempotencyKey: new ObjectId().toHexString(),
    });

  it("checks the draft first: a storyboard, no issues, the current rev", async () => {
    const none = await setup({ spec: null });
    await expect(start(none)).rejects.toMatchObject({
      code: "STAGE_INVALID",
      details: { needs: "storyboard" },
    } satisfies Partial<ProjectError>);
    const tooShort = await setup({ spec: testSpec([exampleScenes.title, exampleScenes.recap]) });
    await expect(start(tooShort)).rejects.toMatchObject({
      code: "STAGE_INVALID",
      details: { needs: "fix_issues" },
    });
    const ok = await setup();
    await expect(start(ok, 3)).rejects.toMatchObject({ code: "REV_CONFLICT" });
  });

  it("reserves a video for an uncounted project and marks it generating", async () => {
    const s = await setup();
    const job = await start(s);
    expect(job).toMatchObject({
      type: "generate",
      usage: { reserved: true },
      input: { baseRev: 0, stageBefore: "draft" },
    });
    expect((await usageOf(s.owner.workspaceId)).videosReserved).toBe(1);
    expect(await getProject(db(), s.owner.workspaceId, s.projectId)).toMatchObject({
      stage: "generating",
      activeJobId: job._id,
    });
  });

  it("at the limit, refuses and leaves no job or claim behind", async () => {
    const s = await setup({ limit: 2, used: 2 });
    await expect(start(s)).rejects.toMatchObject({ code: "LIMIT_REACHED" });
    const project = await getProject(db(), s.owner.workspaceId, s.projectId);
    expect(project.activeJobId).toBeNull();
    expect(project.stage).toBe("draft");
    expect(
      await workspaceCollection(db(), "jobs").countDocuments({ workspaceId: s.owner.workspaceId }),
    ).toBe(0);
  });

  it("doesn't reserve again for a project that already counted", async () => {
    const s = await setup();
    await projectsOf().updateOne(
      { workspaceId: s.owner.workspaceId, _id: s.projectId },
      { $set: { countedAt: now, currentVersion: 1, stage: "ready" } },
    );
    const job = await start(s);
    expect(job.usage.reserved).toBe(false);
    expect(job.input.stageBefore).toBe("ready");
    expect((await usageOf(s.owner.workspaceId)).videosReserved).toBe(0);
  });
});

/** The draft with every scene recorded, as the generation leaves it. */
function recorded(spec: VideoSpec): VideoSpec {
  return {
    ...spec,
    scenes: spec.scenes.map((scene) => ({
      ...scene,
      timing: {
        narrationAssetId: new ObjectId().toHexString(),
        narrationHash: narrationHash(scene.narration, spec.language, spec.voice),
        audioDurationMs: 6000,
        leadInMs: 300,
        durationMs: 6700,
        words: [{ text: "Hi", startMs: 0, endMs: 300 }],
        timingSource: "provider" as const,
      },
    })),
  };
}

describe("saving a generation", () => {
  async function generating(options: Parameters<typeof setup>[0] = {}) {
    const s = await setup(options);
    const job = await startGenerate(db(), s.owner, s.workspace, s.projectId, {
      holder,
      baseRev: 0,
      idempotencyKey: new ObjectId().toHexString(),
    });
    const ids = { workspaceId: s.owner.workspaceId, projectId: s.projectId, jobId: job._id };
    return { ...s, job, ids };
  }

  it("saves version 1, the recorded draft and the video's commit together, once", async () => {
    const g = await generating();
    const snapshot = (await readGenerateSnapshot(db(), g.ids))!;
    expect(snapshot).toMatchObject({ rev: 0, firstGeneration: true });
    const input = {
      spec: recorded(snapshot.spec),
      baseRev: 0,
      userId: g.owner.userId,
      kind: "generate" as const,
    };
    expect(await saveGeneratedVersion(db(), g.ids, input, now)).toEqual({
      versionNumber: 1,
      created: true,
    });
    // A retried save step finds the version it made.
    expect(await saveGeneratedVersion(db(), g.ids, input, now)).toEqual({
      versionNumber: 1,
      created: false,
    });

    const project = await getProject(db(), g.owner.workspaceId, g.projectId);
    expect(project).toMatchObject({
      currentVersion: 1,
      stage: "ready",
      wizardStep: "video",
      countedAt: now,
      draft: { rev: 1 },
    });
    expect(project.draft.spec?.scenes.every((s) => s.timing !== null)).toBe(true);
    expect(await usageOf(g.owner.workspaceId)).toMatchObject({ videosUsed: 1, videosReserved: 0 });
    const versions = await workspaceCollection(db(), "project_versions")
      .find({ workspaceId: g.owner.workspaceId, projectId: g.projectId })
      .toArray();
    expect(versions).toHaveLength(1);
    expect(versions[0]).toMatchObject({ number: 1, reason: "generate", sceneCount: 4 });
    expect(versions[0]!.durationMs).toBe(4 * 6700);

    // Finishing it keeps the committed video.
    await finishJob(
      db(),
      { workspaceId: g.owner.workspaceId, jobId: g.job._id },
      {
        status: "succeeded",
      },
    );
    expect(await usageOf(g.owner.workspaceId)).toMatchObject({ videosUsed: 1, videosReserved: 0 });
  });

  it("saves no new version when a generation changed nothing (F20 QA)", async () => {
    const g = await generating();
    const snapshot = (await readGenerateSnapshot(db(), g.ids))!;
    const spec = recorded(snapshot.spec);
    const input = { spec, baseRev: 0, userId: g.owner.userId, kind: "generate" as const };
    await saveGeneratedVersion(db(), g.ids, input, now);
    // Generate again with nothing changed: a new job over the same recordings.
    await projectsOf().updateOne(
      { workspaceId: g.owner.workspaceId, _id: g.projectId },
      { $set: { stage: "generating" } },
    );
    const again = { ...g.ids, jobId: new ObjectId() };
    expect(await saveGeneratedVersion(db(), again, { ...input, baseRev: 1 }, now)).toEqual({
      versionNumber: 1,
      created: false,
    });
    const project = await getProject(db(), g.owner.workspaceId, g.projectId);
    expect(project).toMatchObject({ currentVersion: 1, stage: "ready" });
    // A changed scene does save one, and says what happened.
    const changed = structuredClone(spec);
    changed.scenes[0]!.timing!.audioDurationMs = 5000;
    changed.scenes[0]!.timing!.durationMs = 5700;
    const third = { ...g.ids, jobId: new ObjectId() };
    await saveGeneratedVersion(db(), third, { ...input, spec: changed, kind: "retry" }, now);
    const latest = await workspaceCollection(db(), "project_versions").findOne({
      workspaceId: g.owner.workspaceId,
      projectId: g.projectId,
      number: 2,
    });
    expect(latest?.summary).toBe("Scenes recorded again");
  });

  it("keeps an edit made meanwhile, adding the recordings that still match it", async () => {
    const g = await generating();
    const snapshot = (await readGenerateSnapshot(db(), g.ids))!;
    // The person changed the second scene's narration while it was recorded.
    const edited = structuredClone(snapshot.spec);
    edited.scenes[1]!.narration = `${edited.scenes[1]!.narration} Really.`;
    await projectsOf().updateOne(
      { workspaceId: g.owner.workspaceId, _id: g.projectId },
      { $set: { "draft.spec": edited }, $inc: { "draft.rev": 1 } },
    );
    await saveGeneratedVersion(db(), g.ids, {
      spec: recorded(snapshot.spec),
      baseRev: 0,
      userId: g.owner.userId,
      kind: "generate",
    });
    const project = await getProject(db(), g.owner.workspaceId, g.projectId);
    expect(project.draft.rev).toBe(2);
    expect(project.draft.spec!.scenes[1]!.narration).toMatch(/Really\.$/);
    expect(project.draft.spec!.scenes[1]!.timing).toBeNull();
    expect(project.draft.spec!.scenes[0]!.timing).not.toBeNull();
  });

  it("gives the video back once when it fails, and returns the project to draft", async () => {
    const g = await generating();
    const ref = { workspaceId: g.owner.workspaceId, jobId: g.job._id };
    const error = { code: "TTS_FAILED", message: "Down", retryable: true };
    await finishJob(db(), ref, { status: "failed", error });
    await finishJob(db(), ref, { status: "failed", error });
    expect((await usageOf(g.owner.workspaceId)).videosReserved).toBe(0);
    const project = await getProject(db(), g.owner.workspaceId, g.projectId);
    expect(project).toMatchObject({ stage: "draft", activeJobId: null, countedAt: null });
    const job = await workspaceCollection(db(), "jobs").findOne({
      workspaceId: g.owner.workspaceId,
      _id: g.job._id,
    });
    expect(job?.usage).toEqual({ reserved: true, committed: false, released: true });
  });
});

describe("recording some scenes again (F23)", () => {
  async function generated(options: { failSecond?: boolean } = {}) {
    const s = await setup();
    const job = await startGenerate(db(), s.owner, s.workspace, s.projectId, {
      holder,
      baseRev: 0,
      idempotencyKey: new ObjectId().toHexString(),
    });
    const ids = { workspaceId: s.owner.workspaceId, projectId: s.projectId, jobId: job._id };
    const snapshot = (await readGenerateSnapshot(db(), ids))!;
    const spec = recorded(snapshot.spec);
    if (options.failSecond) spec.scenes[1]!.timing = null;
    await saveGeneratedVersion(db(), ids, {
      spec,
      baseRev: 0,
      userId: s.owner.userId,
      kind: "generate",
    });
    await finishJob(
      db(),
      { workspaceId: s.owner.workspaceId, jobId: job._id },
      {
        status: options.failSecond ? "partial" : "succeeded",
      },
    );
    return { ...s, spec };
  }

  const narrate = (s: Awaited<ReturnType<typeof generated>>, sceneIds?: string[]) =>
    getProject(db(), s.owner.workspaceId, s.projectId).then((p) =>
      startNarration(db(), s.owner, s.workspace, s.projectId, {
        holder,
        baseRev: p.draft.rev,
        ...(sceneIds ? { sceneIds } : {}),
        idempotencyKey: new ObjectId().toHexString(),
      }),
    );

  it("uses a revision for an edited scene, and gives it back if the job fails", async () => {
    const s = await generated();
    const edited = structuredClone(s.spec);
    edited.scenes[0]!.narration = `${edited.scenes[0]!.narration} Again.`;
    edited.scenes[0]!.timing = null;
    await projectsOf().updateOne(
      { workspaceId: s.owner.workspaceId, _id: s.projectId },
      { $set: { "draft.spec": edited }, $inc: { "draft.rev": 1 } },
    );
    const job = await narrate(s);
    expect(job.input).toMatchObject({ sceneIds: [edited.scenes[0]!.id], countsRevision: true });
    expect((await getProject(db(), s.owner.workspaceId, s.projectId)).revisionsUsed).toBe(1);

    await finishJob(
      db(),
      { workspaceId: s.owner.workspaceId, jobId: job._id },
      {
        status: "failed",
        error: { code: "TTS_FAILED", message: "Down", retryable: true },
      },
    );
    expect((await getProject(db(), s.owner.workspaceId, s.projectId)).revisionsUsed).toBe(0);
  });

  it("retrying a scene that failed uses no revision", async () => {
    const s = await generated({ failSecond: true });
    const job = await narrate(s);
    expect(job.input).toMatchObject({ sceneIds: [s.spec.scenes[1]!.id], countsRevision: false });
    expect((await getProject(db(), s.owner.workspaceId, s.projectId)).revisionsUsed).toBe(0);
  });

  it("at the limit, an edited scene can't be recorded again", async () => {
    const s = await generated();
    const edited = structuredClone(s.spec);
    edited.scenes[2]!.narration = `${edited.scenes[2]!.narration} More.`;
    edited.scenes[2]!.timing = null;
    await projectsOf().updateOne(
      { workspaceId: s.owner.workspaceId, _id: s.projectId },
      { $set: { "draft.spec": edited, revisionsUsed: 30 }, $inc: { "draft.rev": 1 } },
    );
    await expect(narrate(s)).rejects.toMatchObject({
      code: "LIMIT_REACHED",
      details: { limit: "revisionsPerVideo" },
    });
  });

  it("counts new words and a new voice as changes, not a copy of recorded words", () => {
    const version = testSpec(scenes);
    const same = structuredClone(version);
    expect(changedSinceVersion(version, same, [same.scenes[0]!.id])).toBe(false);
    const narration = structuredClone(version);
    narration.scenes[1]!.narration = "Something else entirely.";
    expect(changedSinceVersion(version, narration, [narration.scenes[1]!.id])).toBe(true);
    const voice = { ...structuredClone(version), voice: { ...version.voice, speed: 1.1 } };
    expect(changedSinceVersion(version, voice, [voice.scenes[0]!.id])).toBe(true);
    expect(changedSinceVersion(version, same, ["sc_new00001"])).toBe(true);
    // A copy of a recorded scene, or narration that's another scene's words: nothing new.
    const copied = structuredClone(version);
    copied.scenes.push({ ...copied.scenes[0]!, id: "sc_copy0001", timing: null });
    expect(changedSinceVersion(version, copied, ["sc_copy0001"])).toBe(false);
    expect(changedSinceVersion(null, same, [same.scenes[0]!.id])).toBe(true);
  });
});
