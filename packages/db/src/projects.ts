// Projects (DB §5, §11; API §5). Every function takes the workspace from the caller's session
// and filters on it, so another workspace's project is simply "not found".
import { createHash } from "node:crypto";
import {
  type CreateProjectInput,
  type ListProjectsQuery,
  type SaveDraftInput,
  scriptStats,
  singleLine,
  type UpdateProjectInput,
} from "@vidcosmos/spec/api";
import type { Project, Workspace } from "@vidcosmos/spec/collections";
import { type Db, type Filter, ObjectId, type UpdateFilter } from "mongodb";
import { workspaceCollection } from "./scoped.ts";

export type ProjectErrorCode =
  "NOT_FOUND" | "REV_CONFLICT" | "LEASE_HELD" | "STAGE_INVALID" | "INVALID_CURSOR";

/** A refusal the API turns into its error envelope (API §2). */
export class ProjectError extends Error {
  readonly code: ProjectErrorCode;
  readonly details?: Record<string, unknown>;
  constructor(code: ProjectErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "ProjectError";
    this.code = code;
    this.details = details;
  }
}

const notFound = () => new ProjectError("NOT_FOUND", "That video doesn't exist.");

export type Owner = { workspaceId: ObjectId; userId: ObjectId };

/** The lease lasts 60 s; the editor renews it every 30 s (DB §11). */
export const leaseMs = 60_000;
/** Deleted projects stay in Trash for 30 days (DB §12). */
export const trashDays = 30;

const projects = (db: Db) => workspaceCollection(db, "projects");

/** A route parameter as a project id; anything else can't exist. */
export function parseProjectId(value: string): ObjectId {
  if (!/^[0-9a-f]{24}$/.test(value)) throw notFound();
  return new ObjectId(value);
}

// ---- Stage hashes (DB §5, "Stale steps") ----

export const textHash = (text: string) => createHash("sha256").update(text).digest("hex");

/** What the script was written from: topic, notes and the chosen angle. */
export const ideaHash = (idea: Project["idea"]) =>
  textHash(JSON.stringify([idea.topic, idea.notes ?? null, idea.selectedAngleId ?? null]));

/** Which later steps no longer match what they were made from. */
export function projectStale(project: Project): { script: boolean; storyboard: boolean } {
  const { script, stageHashes, draft } = project;
  return {
    script: Boolean(script && stageHashes.idea && stageHashes.idea !== ideaHash(project.idea)),
    storyboard: Boolean(
      script && draft.spec && stageHashes.script && stageHashes.script !== textHash(script.text),
    ),
  };
}

// ---- Create, read, list ----

export function newProject(
  owner: Owner,
  workspace: Workspace,
  input: CreateProjectInput,
  now: Date,
): Project {
  return {
    _id: new ObjectId(),
    schemaVersion: 1,
    workspaceId: owner.workspaceId,
    createdBy: owner.userId,
    // The topic until the script gives the video a title. A title is one line.
    title: singleLine(input.topic).slice(0, 100).trim(),
    stage: "draft",
    wizardStep: "idea",
    settings: { ...workspace.defaults, voiceSpeed: 1, ...input.settings },
    idea: {
      topic: input.topic,
      videoType: input.videoType ?? "explainer",
      ...(input.notes ? { notes: input.notes } : {}),
      ...(input.goal ? { goal: input.goal } : {}),
      angles: [],
    },
    script: null,
    draft: { spec: null, rev: 0, updatedAt: now, updatedBy: owner.userId },
    currentVersion: null,
    countedAt: null,
    revisionsUsed: 0,
    generationsUsed: 0,
    stageHashes: {},
    activeJobId: null,
    lease: null,
    thumbnailKey: null,
    lastExportId: null,
    lastOpenedAt: now,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
}

export async function createProject(
  db: Db,
  owner: Owner,
  workspace: Workspace,
  input: CreateProjectInput,
  now = new Date(),
): Promise<Project> {
  const project = newProject(owner, workspace, input, now);
  await projects(db).insertOne(project);
  return project;
}

/** A project of this workspace; Trash only when asked. */
export async function getProject(
  db: Db,
  workspaceId: ObjectId,
  projectId: ObjectId,
  options: { deleted?: boolean } = {},
): Promise<Project> {
  const project = await projects(db).findOne({
    workspaceId,
    _id: projectId,
    deletedAt: options.deleted ? { $type: "date" } : null,
  });
  if (!project) throw notFound();
  return project;
}

type Cursor = { s: "updated" | "created"; v: string; i: string };

const encodeCursor = (cursor: Cursor) => Buffer.from(JSON.stringify(cursor)).toString("base64url");

function decodeCursor(value: string, sort: Cursor["s"]): { at: Date; id: ObjectId } {
  const invalid = () =>
    new ProjectError(
      "INVALID_CURSOR",
      "This page link doesn't work any more. Load the list again.",
    );
  let cursor: Partial<Cursor>;
  try {
    cursor = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<Cursor>;
  } catch {
    throw invalid();
  }
  const at = new Date(String(cursor.v));
  if (cursor.s !== sort || Number.isNaN(at.getTime()) || !/^[0-9a-f]{24}$/.test(String(cursor.i))) {
    throw invalid();
  }
  return { at, id: new ObjectId(String(cursor.i)) };
}

const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The library list (DB §10 "Library"): newest first, cursor on (sort field, _id). */
export async function listProjects(
  db: Db,
  workspaceId: ObjectId,
  query: ListProjectsQuery,
): Promise<{ items: Project[]; nextCursor: string | null }> {
  const field = query.sort === "created" ? "createdAt" : "updatedAt";
  const filter: Filter<Project> & { workspaceId: ObjectId } = {
    workspaceId,
    deletedAt: query.trash ? { $type: "date" } : null,
  };
  if (query.stage) filter.stage = { $in: query.stage };
  if (query.language) filter["settings.language"] = query.language;
  if (query.format) filter["settings.format"] = { $in: query.format };

  const and: Filter<Project>[] = [];
  if (query.q) {
    // Atlas Search (projects_search) replaces this on Atlas; the regex is the fallback (DB §5).
    const pattern = { $regex: escapeRegex(query.q), $options: "i" };
    and.push({ $or: [{ title: pattern }, { "idea.topic": pattern }] });
  }
  if (query.cursor) {
    const { at, id } = decodeCursor(query.cursor, query.sort);
    and.push({ $or: [{ [field]: { $lt: at } }, { [field]: at, _id: { $lt: id } }] });
  }
  if (and.length) filter.$and = and;

  const rows = await projects(db)
    .find(filter, { sort: { [field]: -1, _id: -1 }, limit: query.limit + 1 })
    .toArray();
  const items = rows.slice(0, query.limit);
  const last = items.at(-1);
  return {
    items,
    nextCursor:
      rows.length > query.limit && last
        ? encodeCursor({ s: query.sort, v: last[field].toISOString(), i: last._id.toHexString() })
        : null,
  };
}

export type ProjectCounts = Record<Project["stage"], number> & { all: number; trash: number };

/** How many projects each library filter would show (the chip counts). */
export async function countProjects(db: Db, workspaceId: ObjectId): Promise<ProjectCounts> {
  const rows = await projects(db)
    .aggregate<{ _id: { stage: Project["stage"]; deleted: boolean }; n: number }>([
      { $match: { workspaceId } },
      {
        $group: {
          _id: { stage: "$stage", deleted: { $ne: ["$deletedAt", null] } },
          n: { $sum: 1 },
        },
      },
    ])
    .toArray();
  const counts: ProjectCounts = {
    all: 0,
    trash: 0,
    draft: 0,
    generating: 0,
    ready: 0,
    revising: 0,
    failed: 0,
  };
  for (const { _id, n } of rows) {
    if (_id.deleted) counts.trash += n;
    else {
      counts.all += n;
      counts[_id.stage] += n;
    }
  }
  return counts;
}

// ---- Update (PATCH) ----

const wizardOrder: Project["wizardStep"][] = ["idea", "angles", "script", "storyboard", "video"];

/**
 * What a project still needs before the editor may move forward to `step`, or null when it
 * can (decision D4): angles need angles, the script a script, the storyboard a draft spec, the
 * video a saved version. Going back, or staying, is always allowed.
 */
export function wizardStepNeeds(project: Project, step: Project["wizardStep"]): string | null {
  if (wizardOrder.indexOf(step) <= wizardOrder.indexOf(project.wizardStep)) return null;
  switch (step) {
    case "idea":
      return null;
    case "angles":
      return project.idea.angles.length > 0 ? null : "angles";
    case "script":
      return project.script ? null : "script";
    case "storyboard":
      return project.draft.spec ? null : "storyboard";
    case "video":
      return project.currentVersion !== null ? null : "version";
  }
}

/** Applies the update rules of API §5 and returns the project as it is now. */
export async function updateProject(
  db: Db,
  owner: Owner,
  projectId: ObjectId,
  input: UpdateProjectInput,
  now = new Date(),
): Promise<Project> {
  const project = await getProject(db, owner.workspaceId, projectId);
  const set: Record<string, unknown> = { updatedAt: now };
  const unset: Record<string, ""> = {};
  let draftChanged = false;

  if (input.title !== undefined) set.title = input.title;
  if (input.wizardStep !== undefined) {
    const needs = wizardStepNeeds(project, input.wizardStep);
    if (needs) {
      throw new ProjectError(
        "STAGE_INVALID",
        `This video can't move to the ${input.wizardStep} step yet: it needs ${needs === "version" ? "a generated video" : `its ${needs}`} first.`,
        { stage: project.stage, wizardStep: project.wizardStep, needs },
      );
    }
    set.wizardStep = input.wizardStep;
  }

  const settings = input.settings ?? {};
  if (settings.language !== undefined && settings.language !== project.settings.language) {
    if (project.script) {
      throw new ProjectError(
        "STAGE_INVALID",
        "The narration language can't change once a script exists. Start a new video instead.",
        { stage: project.stage, wizardStep: project.wizardStep, needs: "no_script" },
      );
    }
  }
  for (const [key, value] of Object.entries(settings)) {
    if (value !== undefined) set[`settings.${key}`] = value;
  }

  const spec = project.draft.spec;
  if (spec) {
    // Theme and format change only the look: no new audio (API §5).
    if (settings.palette !== undefined) set["draft.spec.theme.palette"] = settings.palette;
    if (settings.captionStyle !== undefined) {
      set["draft.spec.theme.captionStyle"] = settings.captionStyle;
    }
    if (settings.format !== undefined) set["draft.spec.format"] = settings.format;
    // A new voice means new audio: every scene's timing is cleared (API §5).
    const voiceChanged =
      (settings.voiceGender !== undefined &&
        settings.voiceGender !== project.settings.voiceGender) ||
      (settings.voiceSpeed !== undefined && settings.voiceSpeed !== project.settings.voiceSpeed);
    if (settings.voiceGender !== undefined) set["draft.spec.voice.gender"] = settings.voiceGender;
    if (settings.voiceSpeed !== undefined) set["draft.spec.voice.speed"] = settings.voiceSpeed;
    if (voiceChanged && spec.scenes.length > 0) set["draft.spec.scenes.$[].timing"] = null;
    draftChanged = Object.keys(set).some((key) => key.startsWith("draft.spec"));
  }

  if (input.idea) {
    for (const [key, value] of Object.entries(input.idea)) {
      if (value === undefined) continue;
      if (value === null) unset[`idea.${key}`] = "";
      else set[`idea.${key}`] = value;
    }
  }

  if (input.script) {
    if (!project.script) {
      throw new ProjectError("STAGE_INVALID", "There's no script to edit yet.", {
        stage: project.stage,
        wizardStep: project.wizardStep,
        needs: "script",
      });
    }
    const text = input.script.text ?? project.script.text;
    const language = settings.language ?? project.settings.language;
    set.script = {
      ...project.script,
      ...(input.script.title !== undefined ? { title: input.script.title } : {}),
      ...(input.script.hook !== undefined ? { hook: input.script.hook } : {}),
      text,
      ...scriptStats(text, language),
      // The user's own words: an AI script becomes "ai_edited"; their own stays "user".
      source: project.script.source === "user" ? "user" : "ai_edited",
      updatedAt: now,
    };
  }

  if (draftChanged) {
    set["draft.updatedAt"] = now;
    set["draft.updatedBy"] = owner.userId;
  }
  const update: UpdateFilter<Project> = { $set: set };
  if (Object.keys(unset).length) update.$unset = unset;
  if (draftChanged) update.$inc = { "draft.rev": 1 };

  const updated = await projects(db).findOneAndUpdate(
    { workspaceId: owner.workspaceId, _id: projectId, deletedAt: null },
    update,
    { returnDocument: "after" },
  );
  if (!updated) throw notFound();
  return updated;
}

// ---- Edit lease (DB §11) ----

/** The lease belongs to one editor tab: the session id plus the tab's editor id. */
export const leaseHolder = (sessionId: string, editorId: string) => `${sessionId}:${editorId}`;

async function leaseHeldError(db: Db, owner: Owner, projectId: ObjectId, now: Date) {
  const project = await getProject(db, owner.workspaceId, projectId);
  const lease = project.lease && project.lease.expiresAt > now ? project.lease : null;
  return new ProjectError(
    "LEASE_HELD",
    lease
      ? "This video is open for editing somewhere else."
      : "Open the editor again to keep editing.",
    {
      heldBy: lease ? (lease.userId.equals(owner.userId) ? "you_elsewhere" : "other") : null,
      expiresAt: lease?.expiresAt.toISOString() ?? null,
    },
  );
}

/** Take or renew the lease; with `takeover`, take it from whoever has it. */
export async function takeLease(
  db: Db,
  owner: Owner,
  projectId: ObjectId,
  holder: string,
  options: { takeover?: boolean } = {},
  now = new Date(),
): Promise<Project> {
  const lease = {
    holderSessionId: holder,
    userId: owner.userId,
    expiresAt: new Date(now.getTime() + leaseMs),
  };
  const filter: Filter<Project> & { workspaceId: ObjectId } = {
    workspaceId: owner.workspaceId,
    _id: projectId,
    deletedAt: null,
  };
  if (!options.takeover) {
    filter.$or = [
      { lease: null },
      { "lease.expiresAt": { $lt: now } },
      { "lease.holderSessionId": holder },
    ];
  }
  // The lease doesn't touch updatedAt: opening a video doesn't move it up the library.
  const updated = await projects(db).findOneAndUpdate(
    filter,
    { $set: { lease, lastOpenedAt: now } },
    { returnDocument: "after" },
  );
  if (updated) return updated;
  throw await leaseHeldError(db, owner, projectId, now);
}

/** Give the lease up (the tab closed). Only its holder can; anything else changes nothing. */
export async function releaseLease(db: Db, owner: Owner, projectId: ObjectId, holder: string) {
  await projects(db).updateOne(
    { workspaceId: owner.workspaceId, _id: projectId, "lease.holderSessionId": holder },
    { $set: { lease: null } },
  );
}

// ---- Draft autosave (DB §11) ----

type Scene = Record<string, unknown> & { id?: unknown; narration?: unknown; timing?: unknown };

/**
 * Keeps the stored timing of each scene whose narration and voice are unchanged, and clears
 * the rest, so a client can't forge timing (API §5). Returns the scenes that lost it.
 * F16/F20 replace the narration comparison with `narrationHash`.
 */
function carryTiming(stored: Project["draft"]["spec"], incoming: SaveDraftInput["spec"]) {
  const before = new Map<unknown, Scene>(
    ((stored?.scenes ?? []) as Scene[]).map((scene) => [scene.id, scene]),
  );
  const sameVoice =
    JSON.stringify((stored as { voice?: unknown } | null)?.voice ?? null) ===
    JSON.stringify((incoming as { voice?: unknown }).voice ?? null);
  const stale: string[] = [];
  const scenes = (incoming.scenes as Scene[]).map((scene) => {
    const previous = before.get(scene.id);
    const keep = previous && sameVoice && previous.narration === scene.narration;
    const timing = keep ? (previous.timing ?? null) : null;
    if (!keep && previous?.timing) stale.push(String(scene.id));
    return { ...scene, timing };
  });
  return { spec: { ...incoming, scenes }, stale };
}

export async function saveDraft(
  db: Db,
  owner: Owner,
  projectId: ObjectId,
  holder: string,
  input: SaveDraftInput,
  now = new Date(),
): Promise<{ rev: number; updatedAt: Date; staleSceneIds: string[] }> {
  const current = await getProject(db, owner.workspaceId, projectId);
  const { spec, stale } = carryTiming(current.draft.spec, input.spec);
  const updated = await projects(db).findOneAndUpdate(
    {
      workspaceId: owner.workspaceId,
      _id: projectId,
      deletedAt: null,
      "draft.rev": input.baseRev,
      "lease.holderSessionId": holder,
    },
    {
      $set: {
        "draft.spec": spec,
        "draft.updatedAt": now,
        "draft.updatedBy": owner.userId,
        updatedAt: now,
      },
      $inc: { "draft.rev": 1 },
    },
    { returnDocument: "after", projection: { "draft.rev": 1 } },
  );
  if (updated) return { rev: updated.draft.rev, updatedAt: now, staleSceneIds: stale };

  // Nothing matched: say why, lease first (the editor goes read-only), then the revision.
  const project = await getProject(db, owner.workspaceId, projectId);
  if (project.lease?.holderSessionId !== holder)
    throw await leaseHeldError(db, owner, projectId, now);
  throw new ProjectError("REV_CONFLICT", "This video changed in another place.", {
    currentRev: project.draft.rev,
  });
}

// ---- Delete, restore, duplicate ----

/** Moves a project to Trash and cancels its scheduled posts (API §5). */
export async function deleteProject(
  db: Db,
  owner: Owner,
  projectId: ObjectId,
  now = new Date(),
): Promise<{ cancelledPosts: number }> {
  const deleted = await projects(db).findOneAndUpdate(
    { workspaceId: owner.workspaceId, _id: projectId, deletedAt: null },
    { $set: { deletedAt: now, updatedAt: now, lease: null } },
  );
  if (!deleted) throw notFound();
  const posts = await workspaceCollection(db, "posts").updateMany(
    {
      workspaceId: owner.workspaceId,
      projectId,
      status: { $in: ["scheduled", "needs_reconnect"] },
    },
    { $set: { status: "cancelled", cancelledAt: now, updatedAt: now } },
  );
  // Cancelling the project's running job arrives with background jobs (F11).
  return { cancelledPosts: posts.modifiedCount };
}

/** Brings a project back from Trash within 30 days. Its posts stay cancelled. */
export async function restoreProject(
  db: Db,
  owner: Owner,
  projectId: ObjectId,
  now = new Date(),
): Promise<Project> {
  const restored = await projects(db).findOneAndUpdate(
    {
      workspaceId: owner.workspaceId,
      _id: projectId,
      deletedAt: { $type: "date", $gt: new Date(now.getTime() - trashDays * 24 * 60 * 60 * 1000) },
    },
    { $set: { deletedAt: null, updatedAt: now } },
    { returnDocument: "after" },
  );
  if (!restored) throw notFound();
  return restored;
}

/** A new project with the idea, script and draft of another; no versions or history. */
export async function duplicateProject(
  db: Db,
  owner: Owner,
  projectId: ObjectId,
  now = new Date(),
): Promise<Project> {
  const source = await getProject(db, owner.workspaceId, projectId);
  const suffix = " (copy)";
  const copy: Project = {
    ...source,
    _id: new ObjectId(),
    createdBy: owner.userId,
    title: `${source.title.slice(0, 100 - suffix.length).trim()}${suffix}`,
    // Nothing has been generated for the copy yet.
    stage: "draft",
    wizardStep: source.wizardStep === "video" ? "storyboard" : source.wizardStep,
    draft: { spec: source.draft.spec, rev: 0, updatedAt: now, updatedBy: owner.userId },
    currentVersion: null,
    countedAt: null,
    revisionsUsed: 0,
    generationsUsed: 0,
    activeJobId: null,
    lease: null,
    thumbnailKey: null,
    lastExportId: null,
    lastOpenedAt: now,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
  await projects(db).insertOne(copy);
  return copy;
}

// ---- For responses ----

/** The display name of a lease holder (Better Auth's `user`). */
export async function userName(db: Db, userId: ObjectId): Promise<string | undefined> {
  const user = await db
    .collection<{ _id: ObjectId; name?: string }>("user")
    .findOne({ _id: userId }, { projection: { name: 1 } });
  return user?.name;
}

/** The running job of each project that has one, for the library cards. */
export async function activeJobs(db: Db, owner: Owner, list: Project[]) {
  const ids = list.flatMap((p) => (p.activeJobId ? [p.activeJobId] : []));
  if (ids.length === 0) return new Map<string, never>();
  const jobs = await workspaceCollection(db, "jobs")
    .find(
      { workspaceId: owner.workspaceId, _id: { $in: ids } },
      { projection: { type: 1, status: 1, progress: 1 } },
    )
    .toArray();
  return new Map(jobs.map((job) => [job._id.toHexString(), job]));
}
