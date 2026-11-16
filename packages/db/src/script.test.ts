// F15: the script step against MongoDB. A script is saved only while its job holds the project,
// with the idea it was written from; the title follows it unless the user renamed the video; a
// rewrite isn't saved over an edit made meanwhile. Editing the script makes it `ai_edited` and
// moves the hook; a new script over an edited one needs `overwrite`; editing the idea after the
// script marks the script stale.
import { createProjectInput, updateProjectInput } from "@vidcosmos/spec/api";
import type { Project, Workspace } from "@vidcosmos/spec/collections";
import { ObjectId } from "mongodb";
import { beforeAll, describe, expect, it } from "vitest";
import { createJob, finishJob } from "./jobs.ts";
import { migrate } from "./migrate.ts";
import {
  createProject,
  getProject,
  ideaHash,
  leaseHolder,
  type Owner,
  type ProjectError,
  projectStale,
  takeLease,
  updateProject,
} from "./projects.ts";
import {
  checkRewriteRequest,
  checkScriptRequest,
  saveScript,
  undoneRewriteSource,
} from "./script.ts";
import { workspaceCollection } from "./scoped.ts";
import { useTestDatabase } from "./testing/database.ts";
import { ensureWorkspace } from "./workspaces.ts";

const database = useTestDatabase();
const db = () => database.get();

beforeAll(async () => {
  await migrate(db());
});

async function setup(): Promise<Owner & { workspace: Workspace; project: Project }> {
  const userId = new ObjectId();
  const workspace = await ensureWorkspace(db(), { id: userId, name: "Asha Rao" });
  const owner = { userId, workspaceId: workspace._id };
  const project = await createProject(
    db(),
    owner,
    workspace,
    createProjectInput.parse({ topic: "How UPI works" }),
  );
  return { ...owner, workspace, project };
}

/** A script job holding the project, as the route leaves it. */
async function scriptJob(o: Awaited<ReturnType<typeof setup>>) {
  const job = await createJob(db(), o, o.workspace, {
    type: "script",
    projectId: o.project._id,
    input: {},
  });
  return { workspaceId: o.workspaceId, jobId: job._id, projectId: o.project._id };
}

const written = (text: string): NonNullable<Project["script"]> => ({
  title: "UPI in a minute",
  hook: text.split(". ")[0] + ".",
  text,
  wordCount: text.split(" ").length,
  estDurationSec: 1,
  source: "ai",
  updatedAt: new Date(),
});

const read = (o: Owner & { project: Project }) => getProject(db(), o.workspaceId, o.project._id);
const clearJob = (o: Owner & { project: Project }) =>
  workspaceCollection(db(), "projects").updateOne(
    { workspaceId: o.workspaceId, _id: o.project._id },
    { $set: { activeJobId: null } },
  );

describe("saving the script", () => {
  it("saves it with the idea it came from, takes its title and moves to the script step", async () => {
    const o = await setup();
    const ref = await scriptJob(o);
    const hash = ideaHash(o.project.idea);
    const result = await saveScript(db(), ref, {
      script: written("You tap Pay. It moves."),
      ideaHash: hash,
      autoTitle: "How UPI works",
    });
    expect(result).toBe("saved");
    const project = await read(o);
    expect(project.script?.text).toBe("You tap Pay. It moves.");
    expect(project.stageHashes.idea).toBe(hash);
    expect(project.title).toBe("UPI in a minute");
    expect(project.wizardStep).toBe("script");
    expect(projectStale(project).script).toBe(false);
  });

  it("keeps a title the user chose", async () => {
    const o = await setup();
    await updateProject(db(), o, o.project._id, updateProjectInput.parse({ title: "My UPI" }));
    const ref = await scriptJob(o);
    await saveScript(db(), ref, { script: written("A. B."), autoTitle: "How UPI works" });
    expect((await read(o)).title).toBe("My UPI");
  });

  it("writes nothing once the job no longer holds the project", async () => {
    const o = await setup();
    const ref = await scriptJob(o);
    await clearJob(o);
    expect(await saveScript(db(), ref, { script: written("A. B.") })).toBe("gone");
    expect((await read(o)).script).toBeNull();
  });

  it("doesn't save a rewrite over an edit made while it ran", async () => {
    const o = await setup();
    const first = await scriptJob(o);
    await saveScript(db(), first, { script: written("You tap Pay. It moves.") });
    await clearJob(o);

    const rewrite = await scriptJob(o);
    await updateProject(
      db(),
      o,
      o.project._id,
      updateProjectInput.parse({ script: { text: "My own words now." } }),
    );
    const result = await saveScript(db(), rewrite, {
      script: written("Pay. Done."),
      expectText: "You tap Pay. It moves.",
    });
    expect(result).toBe("changed");
    expect((await read(o)).script?.text).toBe("My own words now.");
  });
});

describe("QA fixes (16 Nov)", () => {
  it("a new script isn't saved over an edit made while it was written", async () => {
    const o = await setup();
    await saveScript(db(), await scriptJob(o), { script: written("You tap Pay. It moves.") });
    await clearJob(o);
    const write = await scriptJob(o);
    await updateProject(
      db(),
      o,
      o.project._id,
      updateProjectInput.parse({ script: { text: "My own words." } }),
    );
    const result = await saveScript(db(), write, {
      script: written("Brand new. Script."),
      expectText: "You tap Pay. It moves.",
    });
    expect(result).toBe("changed");
    expect((await read(o)).script?.text).toBe("My own words.");

    // The first script of a video: saved only while there's still none.
    const other = await setup();
    const first = await scriptJob(other);
    expect(await saveScript(db(), first, { script: written("A. B."), expectText: null })).toBe(
      "saved",
    );
  });

  it("the angle a script was written from becomes the picked one, so it isn't stale", async () => {
    const o = await setup();
    await workspaceCollection(db(), "projects").updateOne(
      { workspaceId: o.workspaceId, _id: o.project._id },
      {
        $set: {
          "idea.angles": [
            { id: "ang_a", title: "A", hook: "A hook.", outline: ["x", "y"] },
            { id: "ang_b", title: "B", hook: "B hook.", outline: ["x", "y"] },
          ],
          "idea.selectedAngleId": "ang_a",
        },
      },
    );
    const before = await read(o);
    await saveScript(db(), await scriptJob(o), {
      script: written("A. B."),
      ideaHash: ideaHash({ ...before.idea, selectedAngleId: "ang_b" }),
      angleId: "ang_b",
    });
    const after = await read(o);
    expect(after.idea.selectedAngleId).toBe("ang_b");
    expect(projectStale(after).script).toBe(false);
  });

  it("a script with no words can't be rewritten", async () => {
    const o = await setup();
    await saveScript(db(), await scriptJob(o), { script: written("   ") });
    const empty = await read(o);
    expect(() => checkRewriteRequest(empty, { instruction: "longer" })).toThrow(
      "There's no script to rewrite yet.",
    );
  });

  it("an update from a tab that lost the lease is refused, and the script stays", async () => {
    const o = await setup();
    await saveScript(db(), await scriptJob(o), { script: written("You tap Pay. It moves.") });
    await takeLease(db(), o, o.project._id, leaseHolder("s1", "tab-b"));
    const refused = await updateProject(
      db(),
      o,
      o.project._id,
      updateProjectInput.parse({ script: { text: "Tab A's words." } }),
      new Date(),
      { holder: leaseHolder("s1", "tab-a") },
    ).catch((error: ProjectError) => error);
    expect((refused as ProjectError).code).toBe("LEASE_HELD");
    expect((await read(o)).script?.text).toBe("You tap Pay. It moves.");
    const kept = await updateProject(
      db(),
      o,
      o.project._id,
      updateProjectInput.parse({ script: { text: "Tab B's words." } }),
      new Date(),
      { holder: leaseHolder("s1", "tab-b") },
    );
    expect(kept.script?.text).toBe("Tab B's words.");
  });

  it("undoing a rewrite of the AI's own script keeps it `ai`, but only right after it", async () => {
    const o = await setup();
    await saveScript(db(), await scriptJob(o), { script: written("You tap Pay. It moves.") });
    await clearJob(o);
    const rewrite = await createJob(db(), o, o.workspace, {
      type: "script_rewrite",
      projectId: o.project._id,
      input: {
        instruction: "longer",
        previous: {
          title: "UPI",
          hook: "You tap Pay.",
          text: "You tap Pay. It moves.",
          source: "ai",
        },
      },
    });
    const ref = { workspaceId: o.workspaceId, jobId: rewrite._id, projectId: o.project._id };
    await saveScript(db(), ref, { script: written("You tap Pay. It moves. One more.") });
    await finishJob(db(), ref, { status: "succeeded", result: { type: "script_rewrite" } });

    const project = await read(o);
    expect(await undoneRewriteSource(db(), project, "You tap Pay. It moves.")).toBe("ai");
    expect(await undoneRewriteSource(db(), project, "Something else.")).toBeNull();
    // Edited after the rewrite: undoing is now the user's own edit.
    const edited = await updateProject(
      db(),
      o,
      o.project._id,
      updateProjectInput.parse({ script: { text: "Changed by hand." } }),
    );
    expect(await undoneRewriteSource(db(), edited, "You tap Pay. It moves.")).toBeNull();
  });
});

describe("editing and replacing the script", () => {
  it("an edit makes it ai_edited, recounts it and moves the hook", async () => {
    const o = await setup();
    await saveScript(db(), await scriptJob(o), { script: written("You tap Pay. It moves.") });
    const project = await updateProject(
      db(),
      o,
      o.project._id,
      updateProjectInput.parse({ script: { text: "Money moves fast. Really fast, in India." } }),
    );
    expect(project.script).toMatchObject({
      source: "ai_edited",
      hook: "Money moves fast.",
      wordCount: 7,
      estDurationSec: 2.8,
    });
  });

  it("a new script over an edited one needs overwrite; a rewrite needs a script", async () => {
    const o = await setup();
    expect(() => checkRewriteRequest(o.project, { instruction: "shorter" })).toThrow(
      "There's no script to rewrite yet.",
    );
    await saveScript(db(), await scriptJob(o), { script: written("You tap Pay. It moves.") });
    const fresh = await read(o);
    expect(() => checkScriptRequest(fresh, {})).not.toThrow();

    await updateProject(
      db(),
      o,
      o.project._id,
      updateProjectInput.parse({ script: { text: "Edited." } }),
    );
    const edited = await read(o);
    const refused = (() => {
      try {
        checkScriptRequest(edited, {});
      } catch (error) {
        return error as ProjectError;
      }
    })();
    expect(refused?.code).toBe("STAGE_INVALID");
    expect(refused?.details).toMatchObject({ needs: "overwrite" });
    expect(checkScriptRequest(edited, { overwrite: true })).toEqual({ angleId: null });
    expect(() => checkScriptRequest(edited, { overwrite: true, angleId: "ang_x" })).toThrow(
      "That angle isn't one of this video's angles.",
    );
    expect(() =>
      checkRewriteRequest(edited, { instruction: "shorter", selection: { start: 0, end: 99 } }),
    ).toThrow("The script changed. Select the part again.");
  });

  it("editing the topic, notes or angle after the script marks it stale", async () => {
    const o = await setup();
    await saveScript(db(), await scriptJob(o), {
      script: written("You tap Pay. It moves."),
      ideaHash: ideaHash(o.project.idea),
    });
    expect(projectStale(await read(o)).script).toBe(false);
    // Settings don't make it stale; the idea does.
    await updateProject(
      db(),
      o,
      o.project._id,
      updateProjectInput.parse({ settings: { tone: "calm" } }),
    );
    expect(projectStale(await read(o)).script).toBe(false);
    const changed = await updateProject(
      db(),
      o,
      o.project._id,
      updateProjectInput.parse({ idea: { notes: "NPCI routes every payment." } }),
    );
    expect(projectStale(changed).script).toBe(true);
  });
});
