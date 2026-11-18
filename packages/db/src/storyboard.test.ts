// F17: the storyboard step against MongoDB. A request needs a script, and `overwrite` to replace
// a storyboard; the job's storyboard is saved only while it holds the project and the script
// and draft are as they were, with the script it was made from (so a later script edit marks
// it stale), and moves the wizard to the storyboard step.
import { createProjectInput } from "@vidcosmos/spec/api";
import type { Project, Workspace } from "@vidcosmos/spec/collections";
import { exampleScenes, type VideoSpec, videoSpec } from "@vidcosmos/spec/video";
import { ObjectId } from "mongodb";
import { beforeAll, describe, expect, it } from "vitest";
import { createJob } from "./jobs.ts";
import { migrate } from "./migrate.ts";
import {
  createProject,
  getProject,
  type Owner,
  type ProjectError,
  projectStale,
  textHash,
} from "./projects.ts";
import { workspaceCollection } from "./scoped.ts";
import { checkStoryboardRequest, saveStoryboard } from "./storyboard.ts";
import { useTestDatabase } from "./testing/database.ts";
import { ensureWorkspace } from "./workspaces.ts";

const database = useTestDatabase();
const db = () => database.get();

beforeAll(async () => {
  await migrate(db());
});

const scriptText = `${exampleScenes.title.narration}\n\n${exampleScenes.recap.narration}`;

const spec: VideoSpec = videoSpec.parse({
  version: 1,
  format: "9:16",
  title: "How UPI moves your money",
  language: "en",
  voice: { gender: "female", voiceId: "voice_female_1", model: "eleven_multilingual_v2", speed: 1 },
  theme: { palette: "midnight", captionStyle: "highlight" },
  scenes: [exampleScenes.title, exampleScenes.recap],
});

async function setup(script: string | null = scriptText) {
  const userId = new ObjectId();
  const workspace: Workspace = await ensureWorkspace(db(), { id: userId, name: "Asha Rao" });
  const owner: Owner = { userId, workspaceId: workspace._id };
  const created = await createProject(
    db(),
    owner,
    workspace,
    createProjectInput.parse({ topic: "How UPI works" }),
  );
  if (script !== null) {
    await workspaceCollection(db(), "projects").updateOne(
      { workspaceId: owner.workspaceId, _id: created._id },
      {
        $set: {
          wizardStep: "script",
          script: {
            title: "How UPI moves your money",
            hook: "You tap Pay, and in two seconds your friend has the money.",
            text: script,
            wordCount: 30,
            estDurationSec: 12,
            source: "ai",
            updatedAt: new Date(),
          },
        },
      },
    );
  }
  const project = await getProject(db(), owner.workspaceId, created._id);
  return { owner, workspace, project };
}

/** A storyboard job holding the project, as the route leaves it. */
async function storyboardJob(o: Awaited<ReturnType<typeof setup>>) {
  const job = await createJob(db(), o.owner, o.workspace, {
    type: "storyboard",
    projectId: o.project._id,
    input: {},
  });
  return { workspaceId: o.owner.workspaceId, jobId: job._id, projectId: o.project._id };
}

const refusal = (fn: () => unknown) => {
  try {
    fn();
  } catch (error) {
    return error as ProjectError;
  }
  throw new Error("Expected a refusal.");
};

describe("asking for a storyboard", () => {
  it("needs a script with words in it", async () => {
    const { project } = await setup(null);
    const error = refusal(() => checkStoryboardRequest(project, {}));
    expect(error.code).toBe("STAGE_INVALID");
    expect(error.details).toMatchObject({ needs: "script" });
  });

  it("asks before replacing a storyboard", async () => {
    const { project } = await setup();
    expect(checkStoryboardRequest(project, {}).text).toBe(scriptText);
    const withDraft = { ...project, draft: { ...project.draft, spec } } as Project;
    expect(refusal(() => checkStoryboardRequest(withDraft, {})).details).toMatchObject({
      needs: "overwrite",
    });
    expect(checkStoryboardRequest(withDraft, { overwrite: true }).text).toBe(scriptText);
  });
});

describe("saving the storyboard", () => {
  it("saves the draft with the script it came from and moves to the storyboard step", async () => {
    const o = await setup();
    const ref = await storyboardJob(o);
    const result = await saveStoryboard(db(), ref, {
      spec,
      scriptText,
      baseRev: 0,
      userId: o.owner.userId,
    });
    expect(result).toEqual({ saved: true, rev: 1 });
    const after = await getProject(db(), o.owner.workspaceId, o.project._id);
    expect(after.draft).toMatchObject({ spec, rev: 1, updatedBy: o.owner.userId });
    expect(after.stageHashes.script).toBe(textHash(scriptText));
    expect(after.wizardStep).toBe("storyboard");
    expect(projectStale(after).storyboard).toBe(false);
  });

  it("doesn't move a video already further on back to the storyboard", async () => {
    const o = await setup();
    await workspaceCollection(db(), "projects").updateOne(
      { workspaceId: o.owner.workspaceId, _id: o.project._id },
      { $set: { wizardStep: "video" } },
    );
    const ref = await storyboardJob(o);
    await saveStoryboard(db(), ref, { spec, scriptText, baseRev: 0, userId: o.owner.userId });
    expect((await getProject(db(), o.owner.workspaceId, o.project._id)).wizardStep).toBe("video");
  });

  it("keeps a script or draft edited meanwhile ('changed')", async () => {
    const o = await setup();
    const ref = await storyboardJob(o);
    await workspaceCollection(db(), "projects").updateOne(
      { workspaceId: o.owner.workspaceId, _id: o.project._id },
      { $set: { "script.text": "Edited meanwhile." } },
    );
    const result = await saveStoryboard(db(), ref, {
      spec,
      scriptText,
      baseRev: 0,
      userId: o.owner.userId,
    });
    expect(result).toEqual({ saved: false, reason: "changed" });
    expect((await getProject(db(), o.owner.workspaceId, o.project._id)).draft.spec).toBeNull();

    const stale = await saveStoryboard(db(), ref, {
      spec,
      scriptText: "Edited meanwhile.",
      baseRev: 3,
      userId: o.owner.userId,
    });
    expect(stale).toEqual({ saved: false, reason: "changed" });
  });

  it("saves nothing once the job no longer holds the project ('gone')", async () => {
    const o = await setup();
    const ref = await storyboardJob(o);
    await workspaceCollection(db(), "projects").updateOne(
      { workspaceId: o.owner.workspaceId, _id: o.project._id },
      { $set: { activeJobId: null } },
    );
    const result = await saveStoryboard(db(), ref, {
      spec,
      scriptText,
      baseRev: 0,
      userId: o.owner.userId,
    });
    expect(result).toEqual({ saved: false, reason: "gone" });
  });
});
