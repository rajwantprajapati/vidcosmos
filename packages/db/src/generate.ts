// Generating a video (API §7, DB §11). The route's checks and start, in API order: the lease,
// the draft's rev, a storyboard without issues, no running job, the concurrent jobs, then the
// monthly video, reserved only if the project hasn't counted yet. And the save step: the new
// version, the draft with its timing, and on a first generation the video's commit, all in one
// transaction, so a version never exists without its counted video or the other way round.
import { draftSpec } from "@vidcosmos/spec/api";
import type { Job, Project, ProjectVersion, Workspace } from "@vidcosmos/spec/collections";
import {
  narrationHash,
  reconcileTiming,
  specHash,
  specIssues,
  type VideoSpec,
  videoSpec,
} from "@vidcosmos/spec/video";
import { type Db, ObjectId } from "mongodb";
import { touchAssets } from "./assets.ts";
import { JobError } from "./job-error.ts";
import { createJob, discardJob } from "./jobs.ts";
import { type Owner, ProjectError, takeLease } from "./projects.ts";
import { workspaceCollection } from "./scoped.ts";
import { reserveVideo } from "./usage.ts";

const projects = (db: Db) => workspaceCollection(db, "projects");
const jobs = (db: Db) => workspaceCollection(db, "jobs");

/**
 * The draft to generate: refused with `409 REV_CONFLICT` over an older rev, and `409
 * STAGE_INVALID` without a storyboard (`needs: 'storyboard'`) or with issues to fix
 * (`needs: 'fix_issues'`).
 */
export function checkGenerateRequest(project: Project, baseRev: number): VideoSpec {
  const spec = draftSpec(project);
  if (project.draft.rev !== baseRev) {
    throw new ProjectError("REV_CONFLICT", "This video changed in another place.", {
      currentRev: project.draft.rev,
    });
  }
  const at = { stage: project.stage, wizardStep: project.wizardStep };
  if (!spec) {
    throw new ProjectError("STAGE_INVALID", "Build the storyboard first.", {
      ...at,
      needs: "storyboard",
    });
  }
  const issues = specIssues(spec);
  if (issues.length > 0) {
    throw new ProjectError("STAGE_INVALID", "Fix the marked scenes first.", {
      ...at,
      needs: "fix_issues",
      issues,
    });
  }
  return spec;
}

/** What the generate route keeps in the job's input. */
export type GenerateJobInput = {
  /** The draft's rev the snapshot was taken at. */
  baseRev: number;
  /** The stage to go back to if the generation fails. */
  stageBefore: "draft" | "ready";
};

/**
 * Starts a generation (API §7): checks in API order, creates the job, reserves a video if the
 * project hasn't counted yet, and marks the project `generating`. A refused reservation
 * removes the job again, so nothing is left behind.
 */
export async function startGenerate(
  db: Db,
  owner: Owner,
  workspace: Pick<Workspace, "_id" | "limits">,
  projectId: ObjectId,
  request: { holder: string; baseRev: number; idempotencyKey: string },
  now = new Date(),
): Promise<Job> {
  const project = await takeLease(db, owner, projectId, request.holder);
  checkGenerateRequest(project, request.baseRev);
  const reservesVideo = project.countedAt === null;
  const input: GenerateJobInput = {
    baseRev: request.baseRev,
    stageBefore: project.currentVersion === null ? "draft" : "ready",
  };
  const job = await createJob(
    db,
    owner,
    workspace,
    {
      type: "generate",
      projectId,
      input,
      idempotencyKey: request.idempotencyKey,
      reservesVideo,
    },
    now,
  );
  if (reservesVideo) {
    try {
      await reserveVideo(db, owner.workspaceId, now);
    } catch (error) {
      await discardJob(db, job);
      throw error;
    }
  }
  await projects(db).updateOne(
    { workspaceId: owner.workspaceId, _id: projectId, activeJobId: job._id },
    { $set: { stage: "generating", updatedAt: now } },
  );
  return job;
}

/**
 * Starts recording some scenes again (API §7 "Narration for some scenes"): after a partial
 * generation, or edits that left scenes without narration. Needs a saved version and a draft
 * without issues; the scenes default to those without a current recording, and asking for
 * none, or for scenes the video doesn't have, is `400 VALIDATION_FAILED`. Retrying uses no
 * video and no revision.
 */
export async function startNarration(
  db: Db,
  owner: Owner,
  workspace: Pick<Workspace, "_id" | "limits">,
  projectId: ObjectId,
  request: { holder: string; baseRev: number; sceneIds?: string[]; idempotencyKey: string },
  now = new Date(),
): Promise<Job> {
  const project = await takeLease(db, owner, projectId, request.holder);
  const spec = checkGenerateRequest(project, request.baseRev);
  if (project.currentVersion === null) {
    throw new ProjectError("STAGE_INVALID", "Generate the video first.", {
      stage: project.stage,
      wizardStep: project.wizardStep,
      needs: "version",
    });
  }
  const known = new Set(spec.scenes.map((scene) => scene.id));
  const unknown = (request.sceneIds ?? []).filter((id) => !known.has(id));
  if (unknown.length > 0) {
    throw new ProjectError("VALIDATION_FAILED", "Some of those scenes aren't in this video.", {
      sceneIds: unknown,
    });
  }
  const sceneIds = request.sceneIds ?? narrationTasks(spec).map((task) => task.sceneId);
  if (sceneIds.length === 0) {
    throw new ProjectError("VALIDATION_FAILED", "Every scene already has its narration.");
  }
  // Recording again because something was changed uses a revision; retrying failed scenes
  // doesn't (API §7).
  const current = await workspaceCollection(db, "project_versions").findOne(
    { workspaceId: owner.workspaceId, projectId, number: project.currentVersion },
    { projection: { spec: 1 } },
  );
  const recorded = current ? videoSpec.safeParse(current.spec) : null;
  const counts = changedSinceVersion(recorded?.success ? recorded.data : null, spec, sceneIds);
  if (counts) await reserveRevision(db, owner, projectId, workspace.limits.revisionsPerVideo);
  try {
    return await createJob(
      db,
      owner,
      workspace,
      {
        type: "scene_retry",
        projectId,
        input: { baseRev: request.baseRev, sceneIds, countsRevision: counts },
        idempotencyKey: request.idempotencyKey,
        reservesRevision: counts,
      },
      now,
    );
  } catch (error) {
    if (counts) await returnRevision(db, owner, projectId);
    throw error;
  }
}

/**
 * Whether any of these scenes needs new narration since the version: its words in the draft's
 * voice and language are none of the version's recordings (a new scene, edited narration, or
 * another voice). A failed scene retried, or a duplicate of a recorded one, isn't a change.
 */
export function changedSinceVersion(
  version: {
    language: VideoSpec["language"];
    voice: VideoSpec["voice"];
    scenes: { id: string; narration: string }[];
  } | null,
  draft: VideoSpec,
  sceneIds: string[],
): boolean {
  if (!version) return true;
  const recorded = new Set(
    version.scenes.map((scene) => narrationHash(scene.narration, version.language, version.voice)),
  );
  return sceneIds.some((id) => {
    const now = draft.scenes.find((scene) => scene.id === id);
    return !now || !recorded.has(narrationHash(now.narration, draft.language, draft.voice));
  });
}

/** Uses one of the video's revisions, or refuses with `403 LIMIT_REACHED`. */
async function reserveRevision(db: Db, owner: Owner, projectId: ObjectId, max: number) {
  const reserved = await projects(db).updateOne(
    { workspaceId: owner.workspaceId, _id: projectId, revisionsUsed: { $lt: max } },
    { $inc: { revisionsUsed: 1 } },
  );
  if (reserved.matchedCount === 1) return;
  throw new JobError("LIMIT_REACHED", `This video has used all ${max} of its revisions.`, {
    limit: "revisionsPerVideo",
    used: max,
    max,
    resetsAt: null,
  });
}

/** Gives a revision back (the job that would have used it didn't start, or failed). */
export async function returnRevision(
  db: Db,
  owner: { workspaceId: ObjectId },
  projectId: ObjectId,
) {
  await projects(db).updateOne(
    { workspaceId: owner.workspaceId, _id: projectId, revisionsUsed: { $gt: 0 } },
    { $inc: { revisionsUsed: -1 } },
  );
}

export type GenerateSnapshot = {
  spec: VideoSpec;
  rev: number;
  /** Who asked for it, for the version's `createdBy`. */
  userId: ObjectId;
  /** The first generation commits a video when it saves (DB §11). */
  firstGeneration: boolean;
};

/** The draft a generation records, as it is now. Null when the project or draft is gone. */
export async function readGenerateSnapshot(
  db: Db,
  ids: { workspaceId: ObjectId; projectId: ObjectId; jobId: ObjectId },
): Promise<GenerateSnapshot | null> {
  const [project, job] = await Promise.all([
    projects(db).findOne({ workspaceId: ids.workspaceId, _id: ids.projectId, deletedAt: null }),
    jobs(db).findOne({ workspaceId: ids.workspaceId, _id: ids.jobId }),
  ]);
  const spec = project ? draftSpec(project) : null;
  if (!project || !job || !spec) return null;
  return {
    spec,
    rev: project.draft.rev,
    userId: job.userId,
    firstGeneration: project.countedAt === null,
  };
}

/**
 * The draft after a generation: the recorded spec when nobody changed the draft meanwhile;
 * otherwise the person's newer draft, with the new recordings on each scene whose narration
 * and voice still match them.
 */
function draftAfter(current: VideoSpec | null, recorded: VideoSpec, sameRev: boolean): VideoSpec {
  if (sameRev || !current) return recorded;
  const timings = new Map(recorded.scenes.map((scene) => [scene.id, scene.timing]));
  const scenes = current.scenes.map((scene) =>
    scene.timing ? scene : { ...scene, timing: timings.get(scene.id) ?? null },
  );
  return reconcileTiming({ ...current, scenes }).spec;
}

/** The version a generation left current; `created` is false when nothing had changed. */
export type GeneratedSave = { versionNumber: number; created: boolean };

/** What a saved version's history line says. */
const versionSummary = (number: number, kind: "generate" | "retry") =>
  number === 1 ? "First version" : kind === "retry" ? "Scenes recorded again" : "Generated again";

/**
 * Saves a generation (DB §11 "Transactions"): inserts the next version, sets it current, puts
 * the recordings in the draft, marks the project `ready` at step `video`, and on a first
 * generation commits the reserved video and sets `countedAt`. Retrying it after it saved
 * returns the same version instead of saving another, and a generation that changed nothing
 * (the same spec as the current version) saves no new version (F20 QA).
 */
export async function saveGeneratedVersion(
  db: Db,
  ids: { workspaceId: ObjectId; projectId: ObjectId; jobId: ObjectId },
  input: {
    spec: VideoSpec;
    baseRev: number;
    userId: ObjectId;
    /** A whole generation, or some scenes recorded again. */
    kind: "generate" | "retry";
  },
  now = new Date(),
): Promise<GeneratedSave> {
  const already = await workspaceCollection(db, "project_versions").findOne({
    workspaceId: ids.workspaceId,
    projectId: ids.projectId,
    jobId: ids.jobId,
  });
  if (already) return { versionNumber: already.number, created: false };

  const session = db.client.startSession();
  try {
    return await session.withTransaction(
      async () => {
        const project = await projects(db).findOne(
          { workspaceId: ids.workspaceId, _id: ids.projectId, deletedAt: null },
          { session },
        );
        if (!project) throw new ProjectError("NOT_FOUND", "That video doesn't exist.");
        const job = await jobs(db).findOne(
          { workspaceId: ids.workspaceId, _id: ids.jobId },
          { session },
        );
        // Nothing changed since the current version: keep it, and the project is ready again.
        const hash = specHash(input.spec);
        if (project.currentVersion !== null) {
          const current = await workspaceCollection(db, "project_versions").findOne(
            {
              workspaceId: ids.workspaceId,
              projectId: ids.projectId,
              number: project.currentVersion,
            },
            { session, projection: { specHash: 1 } },
          );
          if (current?.specHash === hash) {
            await projects(db).updateOne(
              { workspaceId: ids.workspaceId, _id: ids.projectId },
              { $set: { stage: "ready", wizardStep: "video", updatedAt: now } },
              { session },
            );
            return { versionNumber: project.currentVersion, created: false };
          }
        }
        const number = (project.currentVersion ?? 0) + 1;
        const version: ProjectVersion = {
          _id: new ObjectId(),
          schemaVersion: 1,
          workspaceId: ids.workspaceId,
          projectId: ids.projectId,
          number,
          spec: input.spec,
          specHash: hash,
          reason: "generate",
          summary: versionSummary(number, input.kind),
          jobId: ids.jobId,
          durationMs: input.spec.scenes.reduce((sum, s) => sum + (s.timing?.durationMs ?? 0), 0),
          sceneCount: input.spec.scenes.length,
          createdBy: input.userId,
          createdAt: now,
        };
        await workspaceCollection(db, "project_versions").insertOne(version, { session });

        const draft = draftAfter(
          draftSpec(project),
          input.spec,
          project.draft.rev === input.baseRev,
        );
        // The video counts once: the first generation that saves, holding a reservation.
        const commits = project.countedAt === null && job?.usage.reserved === true;
        await projects(db).updateOne(
          { workspaceId: ids.workspaceId, _id: ids.projectId },
          {
            $set: {
              "draft.spec": draft,
              "draft.updatedAt": now,
              "draft.updatedBy": input.userId,
              currentVersion: number,
              stage: "ready",
              wizardStep: "video",
              updatedAt: now,
              ...(commits ? { countedAt: now } : {}),
            },
            $inc: { "draft.rev": 1 },
          },
          { session },
        );
        if (commits) {
          await workspaceCollection(db, "workspaces").updateOne(
            { _id: ids.workspaceId },
            {
              $inc: { "usage.videosUsed": 1, "usage.videosReserved": -1 },
              $set: { updatedAt: now },
            },
            { session },
          );
          await jobs(db).updateOne(
            { workspaceId: ids.workspaceId, _id: ids.jobId },
            { $set: { "usage.committed": true } },
            { session },
          );
        }
        return { versionNumber: number, created: true };
      },
      { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } },
    );
  } finally {
    await session.endSession();
  }
}

/** The scenes without a recording that matches their narration and the video's voice. */
const narrationTasks = (spec: VideoSpec) =>
  spec.scenes
    .filter(
      (scene) =>
        scene.timing?.narrationHash !== narrationHash(scene.narration, spec.language, spec.voice),
    )
    .map((scene) => ({ sceneId: scene.id }));

/** Marks the recordings a saved spec uses as used now, so the sweeper keeps them. */
export function touchSpecAudio(db: Db, workspaceId: ObjectId, spec: VideoSpec, now = new Date()) {
  const hashes = spec.scenes.flatMap((scene) => (scene.timing ? [scene.timing.narrationHash] : []));
  return touchAssets(db, workspaceId, "narration", hashes, now);
}
