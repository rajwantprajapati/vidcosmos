// F08: projects against MongoDB. Ownership (another workspace gets "not found"), REV_CONFLICT,
// LEASE_HELD, soft delete and restore, every list filter and the PATCH rules.
import {
  createProjectInput,
  listProjectsQuery,
  projectDetailDto,
  projectSummaryDto,
  toProjectDetailDto,
  toProjectSummaryDto,
} from "@vidcosmos/spec/api";
import type { Project, Workspace } from "@vidcosmos/spec/collections";
import { ObjectId } from "mongodb";
import { beforeAll, describe, expect, it } from "vitest";
import { migrate } from "./migrate.ts";
import {
  createProject,
  deleteProject,
  duplicateProject,
  getProject,
  listProjects,
  leaseHolder,
  type Owner,
  projectStale,
  ProjectError,
  releaseLease,
  restoreProject,
  saveDraft,
  takeLease,
  textHash,
  updateProject,
} from "./projects.ts";
import { workspaceCollection } from "./scoped.ts";
import { useTestDatabase } from "./testing/database.ts";
import { ensureWorkspace } from "./workspaces.ts";

const database = useTestDatabase();
const db = () => database.get();

beforeAll(async () => {
  await migrate(db());
});

async function newOwner(name = "Asha Rao"): Promise<Owner & { workspace: Workspace }> {
  const userId = new ObjectId();
  await db()
    .collection("user")
    .insertOne({ _id: userId, name, email: `${userId}@example.com` });
  const workspace = await ensureWorkspace(db(), { id: userId, name });
  return { userId, workspaceId: workspace._id, workspace };
}

const create = (
  owner: Owner & { workspace: Workspace },
  topic = "How UPI moves money",
  extra = {},
) => createProject(db(), owner, owner.workspace, createProjectInput.parse({ topic, ...extra }));

const list = (owner: Owner, query: Record<string, unknown> = {}) =>
  listProjects(db(), owner.workspaceId, listProjectsQuery.parse(query));

/** Expects the promise to fail with one ProjectError code. */
async function refused(promise: Promise<unknown>, code: string) {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(ProjectError);
  expect((error as ProjectError).code).toBe(code);
  return error as ProjectError;
}

/** Gives a project a script and a two-scene draft with timing, as generation will. */
async function withScriptAndDraft(project: Project) {
  const now = new Date();
  await workspaceCollection(db(), "projects").updateOne(
    { workspaceId: project.workspaceId, _id: project._id },
    {
      $set: {
        script: {
          title: "How UPI moves money",
          hook: "Three hops.",
          text: "Every UPI payment makes three hops.",
          wordCount: 6,
          estDurationSec: 2.4,
          source: "ai",
          updatedAt: now,
        },
        stageHashes: { script: textHash("Every UPI payment makes three hops.") },
        "draft.spec": {
          version: 1,
          format: "9:16",
          voice: { gender: "female", speed: 1 },
          theme: { palette: "midnight", captionStyle: "highlight" },
          scenes: [
            { id: "sc_one", narration: "Every UPI payment", timing: { durationMs: 2000 } },
            { id: "sc_two", narration: "makes three hops.", timing: { durationMs: 1500 } },
          ],
        },
      },
    },
  );
  return getProject(db(), project.workspaceId, project._id);
}

describe("create and read", () => {
  it("starts from the topic, with the workspace defaults and overrides", async () => {
    const owner = await newOwner();
    const project = await create(owner, "  How UPI moves money  ", {
      notes: "For class 8",
      settings: { format: "16:9" },
    });
    expect(project).toMatchObject({
      title: "How UPI moves money",
      stage: "draft",
      wizardStep: "idea",
      idea: { topic: "How UPI moves money", notes: "For class 8", angles: [] },
      draft: { spec: null, rev: 0 },
      settings: { format: "16:9", language: "en", voiceGender: "female", voiceSpeed: 1 },
    });
  });

  it("maps to the API types without internal fields", async () => {
    const owner = await newOwner();
    const project = await create(owner);
    const summary = toProjectSummaryDto(project);
    expect(projectSummaryDto.parse(summary)).toEqual(summary);
    const detail = toProjectDetailDto(project, {
      workspace: owner.workspace,
      stale: projectStale(project),
    });
    expect(projectDetailDto.parse(detail)).toEqual(detail);
    expect(JSON.stringify(detail)).not.toMatch(/workspaceId|holderSessionId|createdBy/);
    expect(detail.counters).toEqual({
      revisionsUsed: 0,
      revisionsMax: 30,
      generationsUsed: 0,
      generationsMax: 50,
    });
  });
});

describe("ownership: another workspace's project is not found", () => {
  it("for every operation", async () => {
    const mine = await newOwner();
    const theirs = await newOwner("Ravi");
    const project = await create(theirs);
    const holder = leaseHolder("session", "tab");
    await refused(getProject(db(), mine.workspaceId, project._id), "NOT_FOUND");
    await refused(updateProject(db(), mine, project._id, { title: "Mine now" }), "NOT_FOUND");
    await refused(takeLease(db(), mine, project._id, holder), "NOT_FOUND");
    await refused(takeLease(db(), mine, project._id, holder, { takeover: true }), "NOT_FOUND");
    await refused(
      saveDraft(db(), mine, project._id, holder, { baseRev: 0, spec: { version: 1, scenes: [] } }),
      "NOT_FOUND",
    );
    await refused(duplicateProject(db(), mine, project._id), "NOT_FOUND");
    await refused(deleteProject(db(), mine, project._id), "NOT_FOUND");
    await refused(restoreProject(db(), mine, project._id), "NOT_FOUND");
    expect((await list(mine)).items).toEqual([]);

    // Untouched for its owner.
    const still = await getProject(db(), theirs.workspaceId, project._id);
    expect(still.title).toBe(project.title);
    expect(still.lease).toBeNull();
  });
});

describe("edit lease", () => {
  it("is taken, renewed and released by one tab", async () => {
    const owner = await newOwner();
    const project = await create(owner);
    const tab = leaseHolder("s1", "tab-a");
    const now = new Date("2026-11-12T10:00:00Z");
    const taken = await takeLease(db(), owner, project._id, tab, {}, now);
    expect(taken.lease).toMatchObject({
      holderSessionId: tab,
      expiresAt: new Date("2026-11-12T10:01:00Z"),
    });
    const renewed = await takeLease(
      db(),
      owner,
      project._id,
      tab,
      {},
      new Date("2026-11-12T10:00:30Z"),
    );
    expect(renewed.lease?.expiresAt).toEqual(new Date("2026-11-12T10:01:30Z"));
    // Taking the lease doesn't move the video up the library.
    expect(renewed.updatedAt).toEqual(project.updatedAt);

    await releaseLease(db(), owner, project._id, leaseHolder("s1", "tab-b")); // not the holder
    expect((await getProject(db(), owner.workspaceId, project._id)).lease).not.toBeNull();
    await releaseLease(db(), owner, project._id, tab);
    expect((await getProject(db(), owner.workspaceId, project._id)).lease).toBeNull();
  });

  it("held by another tab is 423 LEASE_HELD until it expires, or a takeover", async () => {
    const owner = await newOwner();
    const project = await create(owner);
    const now = new Date("2026-11-12T10:00:00Z");
    await takeLease(db(), owner, project._id, leaseHolder("s1", "tab-a"), {}, now);

    const held = await refused(
      takeLease(
        db(),
        owner,
        project._id,
        leaseHolder("s1", "tab-b"),
        {},
        new Date("2026-11-12T10:00:10Z"),
      ),
      "LEASE_HELD",
    );
    expect(held.details).toEqual({
      heldBy: "you_elsewhere",
      expiresAt: "2026-11-12T10:01:00.000Z",
    });

    const taken = await takeLease(db(), owner, project._id, leaseHolder("s1", "tab-b"), {
      takeover: true,
    });
    expect(taken.lease?.holderSessionId).toBe(leaseHolder("s1", "tab-b"));

    // After it expires, anyone may take it.
    const later = new Date(Date.now() + 61_000);
    const after = await takeLease(db(), owner, project._id, leaseHolder("s2", "tab-c"), {}, later);
    expect(after.lease?.holderSessionId).toBe(leaseHolder("s2", "tab-c"));
  });
});

describe("draft autosave", () => {
  async function editing() {
    const owner = await newOwner();
    const project = await withScriptAndDraft(await create(owner));
    const holder = leaseHolder("s1", "tab-a");
    await takeLease(db(), owner, project._id, holder);
    return { owner, project, holder };
  }

  it("saves with the current rev and returns the next one", async () => {
    const { owner, project, holder } = await editing();
    const spec = { ...project.draft.spec!, title: "New title" };
    const saved = await saveDraft(db(), owner, project._id, holder, { baseRev: 0, spec });
    expect(saved.rev).toBe(1);
    const again = await saveDraft(db(), owner, project._id, holder, { baseRev: 1, spec });
    expect(again.rev).toBe(2);
  });

  it("an old rev is 409 REV_CONFLICT with the current one", async () => {
    const { owner, project, holder } = await editing();
    const spec = project.draft.spec!;
    await saveDraft(db(), owner, project._id, holder, { baseRev: 0, spec });
    const conflict = await refused(
      saveDraft(db(), owner, project._id, holder, { baseRev: 0, spec }),
      "REV_CONFLICT",
    );
    expect(conflict.details).toEqual({ currentRev: 1 });
  });

  it("without the lease is 423 LEASE_HELD, and nothing is saved", async () => {
    const { owner, project } = await editing();
    // Another tab of the same user; the first tab still holds the lease.
    const held = await refused(
      saveDraft(db(), owner, project._id, leaseHolder("s1", "tab-b"), {
        baseRev: 0,
        spec: { version: 1, scenes: [] },
      }),
      "LEASE_HELD",
    );
    expect(held.details).toMatchObject({ heldBy: "you_elsewhere" });
    expect((await getProject(db(), owner.workspaceId, project._id)).draft.rev).toBe(0);
  });

  it("keeps stored timing only where the narration is unchanged", async () => {
    const { owner, project, holder } = await editing();
    const [one, two] = project.draft.spec!.scenes as Record<string, unknown>[];
    const spec = {
      ...project.draft.spec!,
      scenes: [
        { ...one, timing: { durationMs: 99_999 } }, // forged: the stored timing comes back
        { ...two, narration: "makes four hops.", timing: { durationMs: 1500 } }, // new words
        { id: "sc_new", narration: "And arrives.", timing: { durationMs: 10 } },
      ],
    };
    const saved = await saveDraft(db(), owner, project._id, holder, { baseRev: 0, spec });
    expect(saved.staleSceneIds).toEqual(["sc_two"]);
    const stored = (await getProject(db(), owner.workspaceId, project._id)).draft.spec!.scenes;
    expect(stored.map((s) => (s as { timing: unknown }).timing)).toEqual([
      { durationMs: 2000 },
      null,
      null,
    ]);
  });
});

describe("update rules (PATCH)", () => {
  it("renames, and moves the wizard step back freely", async () => {
    const owner = await newOwner();
    const project = await withScriptAndDraft(await create(owner));
    await workspaceCollection(db(), "projects").updateOne(
      { workspaceId: owner.workspaceId, _id: project._id },
      { $set: { wizardStep: "storyboard" } },
    );
    const updated = await updateProject(db(), owner, project._id, {
      title: "UPI in 3 hops",
      wizardStep: "idea",
    });
    expect(updated).toMatchObject({ title: "UPI in 3 hops", wizardStep: "idea" });
    expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(project.updatedAt.getTime());
  });

  it("moves forward only to a step whose input exists (D4)", async () => {
    const owner = await newOwner();
    const project = await create(owner);
    for (const [step, needs] of [
      ["angles", "angles"],
      ["script", "script"],
      ["storyboard", "storyboard"],
      ["video", "version"],
    ] as const) {
      const error = await refused(
        updateProject(db(), owner, project._id, { wizardStep: step }),
        "STAGE_INVALID",
      );
      expect(error.details).toEqual({ stage: "draft", wizardStep: "idea", needs });
    }
    expect((await getProject(db(), owner.workspaceId, project._id)).wizardStep).toBe("idea");

    // With a script and a draft spec, but no version yet.
    await withScriptAndDraft(project);
    expect(
      (await updateProject(db(), owner, project._id, { wizardStep: "script" })).wizardStep,
    ).toBe("script");
    expect(
      (await updateProject(db(), owner, project._id, { wizardStep: "storyboard" })).wizardStep,
    ).toBe("storyboard");
    await refused(
      updateProject(db(), owner, project._id, { wizardStep: "video" }),
      "STAGE_INVALID",
    );
    await workspaceCollection(db(), "projects").updateOne(
      { workspaceId: owner.workspaceId, _id: project._id },
      { $set: { currentVersion: 1 } },
    );
    expect(
      (await updateProject(db(), owner, project._id, { wizardStep: "video" })).wizardStep,
    ).toBe("video");
  });

  it("a refused step changes nothing else in the same request", async () => {
    const owner = await newOwner();
    const project = await create(owner);
    await refused(
      updateProject(db(), owner, project._id, { title: "Changed", wizardStep: "video" }),
      "STAGE_INVALID",
    );
    expect((await getProject(db(), owner.workspaceId, project._id)).title).toBe(project.title);
  });

  it("the language can't change once a script exists (409 STAGE_INVALID)", async () => {
    const owner = await newOwner();
    const plain = await create(owner);
    expect(
      (await updateProject(db(), owner, plain._id, { settings: { language: "hi" } })).settings
        .language,
    ).toBe("hi");

    const scripted = await withScriptAndDraft(await create(owner));
    await refused(
      updateProject(db(), owner, scripted._id, { settings: { language: "hi" } }),
      "STAGE_INVALID",
    );
  });

  it("theme and format change the draft, keep the audio, and bump the rev", async () => {
    const owner = await newOwner();
    const project = await withScriptAndDraft(await create(owner));
    const updated = await updateProject(db(), owner, project._id, {
      settings: { palette: "ocean", format: "1:1" },
    });
    expect(updated.draft.rev).toBe(1);
    expect(updated.draft.spec).toMatchObject({ format: "1:1", theme: { palette: "ocean" } });
    expect((updated.draft.spec!.scenes[0] as { timing: unknown }).timing).toEqual({
      durationMs: 2000,
    });
  });

  it("a new voice clears every scene's timing", async () => {
    const owner = await newOwner();
    const project = await withScriptAndDraft(await create(owner));
    const updated = await updateProject(db(), owner, project._id, {
      settings: { voiceGender: "male" },
    });
    expect(updated.draft.spec!.scenes.map((s) => (s as { timing: unknown }).timing)).toEqual([
      null,
      null,
    ]);
    expect(updated.draft.spec).toMatchObject({ voice: { gender: "male" } });
  });

  it("editing the script marks it the user's and the storyboard stale", async () => {
    const owner = await newOwner();
    const project = await withScriptAndDraft(await create(owner));
    expect(projectStale(project)).toEqual({ script: false, storyboard: false });
    const updated = await updateProject(db(), owner, project._id, {
      script: { text: "Every UPI payment makes four quick hops." },
    });
    expect(updated.script).toMatchObject({
      source: "ai_edited",
      wordCount: 7,
      estDurationSec: 2.8,
    });
    expect(projectStale(updated)).toEqual({ script: false, storyboard: true });
  });

  it("a script edit before there is a script is 409 STAGE_INVALID", async () => {
    const owner = await newOwner();
    const project = await create(owner);
    await refused(
      updateProject(db(), owner, project._id, { script: { text: "Hi" } }),
      "STAGE_INVALID",
    );
  });

  it("null clears an idea field", async () => {
    const owner = await newOwner();
    const project = await create(owner, "Photosynthesis", { notes: "Class 8", goal: "teach" });
    const updated = await updateProject(db(), owner, project._id, {
      idea: { notes: null, goal: null },
    });
    expect(updated.idea).not.toHaveProperty("notes");
    expect(updated.idea).not.toHaveProperty("goal");
  });
});

describe("soft delete and restore", () => {
  it("moves to Trash, cancels scheduled posts, and comes back without them", async () => {
    const owner = await newOwner();
    const project = await create(owner);
    const posts = workspaceCollection(db(), "posts");
    const post = (status: "scheduled" | "published") => ({
      _id: new ObjectId(),
      schemaVersion: 1,
      workspaceId: owner.workspaceId,
      projectId: project._id,
      exportId: new ObjectId(),
      socialAccountId: new ObjectId(),
      createdBy: owner.userId,
      caption: "x",
      shareToFeed: true,
      scheduledFor: new Date(),
      timeZone: "Asia/Kolkata",
      status,
      attempts: 0,
      inngestEventId: "e",
      ig: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await posts.insertOne(post("scheduled"));
    await posts.insertOne(post("published"));

    expect(await deleteProject(db(), owner, project._id)).toEqual({ cancelledPosts: 1 });
    await refused(getProject(db(), owner.workspaceId, project._id), "NOT_FOUND");
    expect((await list(owner)).items).toEqual([]);
    expect((await list(owner, { trash: "true" })).items.map((p) => p.title)).toEqual([
      project.title,
    ]);
    await refused(deleteProject(db(), owner, project._id), "NOT_FOUND"); // already in Trash

    const restored = await restoreProject(db(), owner, project._id);
    expect(restored.deletedAt).toBeNull();
    expect((await list(owner)).items).toHaveLength(1);
    expect(
      await posts.countDocuments({ workspaceId: owner.workspaceId, status: "cancelled" }),
    ).toBe(1);
  });

  it("can't restore after 30 days, or what isn't in Trash", async () => {
    const owner = await newOwner();
    const project = await create(owner);
    await refused(restoreProject(db(), owner, project._id), "NOT_FOUND");
    await deleteProject(db(), owner, project._id, new Date("2026-10-01T00:00:00Z"));
    await refused(
      restoreProject(db(), owner, project._id, new Date("2026-11-12T00:00:00Z")),
      "NOT_FOUND",
    );
  });
});

describe("duplicate", () => {
  it("copies idea, script and draft as a new draft project, without history", async () => {
    const owner = await newOwner();
    const source = await withScriptAndDraft(await create(owner));
    await workspaceCollection(db(), "projects").updateOne(
      { workspaceId: owner.workspaceId, _id: source._id },
      { $set: { stage: "ready", wizardStep: "video", currentVersion: 3, revisionsUsed: 4 } },
    );
    const copy = await duplicateProject(db(), owner, source._id);
    expect(copy._id.equals(source._id)).toBe(false);
    expect(copy).toMatchObject({
      title: "How UPI moves money (copy)",
      stage: "draft",
      wizardStep: "storyboard",
      currentVersion: null,
      revisionsUsed: 0,
      draft: { rev: 0, spec: source.draft.spec },
      script: { text: source.script!.text },
    });
  });
});

describe("list filters", () => {
  let owner: Owner & { workspace: Workspace };
  const at = (minute: number) => new Date(Date.UTC(2026, 10, 12, 10, minute));

  beforeAll(async () => {
    owner = await newOwner();
    const rows: [string, Partial<Project["settings"]>, Project["stage"]][] = [
      ["Photosynthesis in 60 seconds", { language: "en", format: "9:16" }, "ready"],
      ["How UPI moves money", { language: "hi", format: "16:9" }, "draft"],
      ["Diwali gift guide", { language: "en", format: "1:1" }, "failed"],
      ["The tiger who was scared", { language: "hi", format: "9:16" }, "ready"],
      ["Ladakh in 30 seconds (1+1)", { language: "en", format: "16:9" }, "generating"],
    ];
    for (const [index, [topic, settings, stage]] of rows.entries()) {
      const project = await createProject(
        db(),
        owner,
        owner.workspace,
        createProjectInput.parse({ topic, settings }),
        at(index),
      );
      // Created in order; "updated" in reverse, so the two sorts differ.
      await workspaceCollection(db(), "projects").updateOne(
        { workspaceId: owner.workspaceId, _id: project._id },
        { $set: { stage, updatedAt: at(50 - index) } },
      );
    }
  });

  const titles = async (query: Record<string, unknown>) =>
    (await list(owner, query)).items.map((p) => p.title);

  it("sorts by updated (default) or created, newest first", async () => {
    expect(await titles({})).toEqual([
      "Photosynthesis in 60 seconds",
      "How UPI moves money",
      "Diwali gift guide",
      "The tiger who was scared",
      "Ladakh in 30 seconds (1+1)",
    ]);
    expect((await titles({ sort: "created" }))[0]).toBe("Ladakh in 30 seconds (1+1)");
  });

  it("filters by one or more stages", async () => {
    expect(await titles({ stage: "ready" })).toEqual([
      "Photosynthesis in 60 seconds",
      "The tiger who was scared",
    ]);
    expect(await titles({ stage: ["draft", "failed"] })).toEqual([
      "How UPI moves money",
      "Diwali gift guide",
    ]);
  });

  it("filters by language and by one or more formats", async () => {
    expect(await titles({ language: "hi" })).toEqual([
      "How UPI moves money",
      "The tiger who was scared",
    ]);
    expect(await titles({ format: "16:9" })).toEqual([
      "How UPI moves money",
      "Ladakh in 30 seconds (1+1)",
    ]);
    expect(await titles({ format: ["1:1", "9:16"], language: "en" })).toEqual([
      "Photosynthesis in 60 seconds",
      "Diwali gift guide",
    ]);
  });

  it("searches title and topic, ignoring case and treating the text literally", async () => {
    expect(await titles({ q: "upi" })).toEqual(["How UPI moves money"]);
    expect(await titles({ q: "SECONDS" })).toEqual([
      "Photosynthesis in 60 seconds",
      "Ladakh in 30 seconds (1+1)",
    ]);
    expect(await titles({ q: "(1+1)" })).toEqual(["Ladakh in 30 seconds (1+1)"]);
    expect(await titles({ q: ".*" })).toEqual([]);
  });

  it("pages with a cursor, for either sort", async () => {
    for (const sort of ["updated", "created"]) {
      const seen: string[] = [];
      let cursor: string | undefined;
      do {
        const page = await list(owner, { sort, limit: 2, ...(cursor ? { cursor } : {}) });
        expect(page.items.length).toBeLessThanOrEqual(2);
        seen.push(...page.items.map((p) => p.title));
        cursor = page.nextCursor ?? undefined;
      } while (cursor);
      expect(seen).toEqual(await titles({ sort }));
    }
  });

  it("a cursor from the other sort, or garbage, is INVALID_CURSOR", async () => {
    const page = await list(owner, { sort: "updated", limit: 2 });
    await refused(list(owner, { sort: "created", cursor: page.nextCursor }), "INVALID_CURSOR");
    await refused(list(owner, { cursor: "not-a-cursor" }), "INVALID_CURSOR");
  });

  it("trash lists deleted projects only", async () => {
    const extra = await create(owner, "Monday motivation");
    await deleteProject(db(), owner, extra._id);
    expect(await titles({ trash: "true" })).toEqual(["Monday motivation"]);
    expect(await titles({})).not.toContain("Monday motivation");
  });
});
