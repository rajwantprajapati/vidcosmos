// F14: AI requests per video and the angles step against MongoDB: the limit holds under
// parallel requests, a failed job gives its request back once, a succeeded one keeps it,
// angles replace the old ones and clear the pick only while the job holds the project, and a
// picked angle must be one of the project's angles.
import { createProjectInput, updateProjectInput } from "@vidcosmos/spec/api";
import type { Workspace } from "@vidcosmos/spec/collections";
import { ObjectId } from "mongodb";
import { beforeAll, describe, expect, it } from "vitest";
import { readIdeaInputs, reserveGeneration, saveAngles } from "./ideas.ts";
import { createJob, finishJob, JobError, releaseJobGeneration } from "./jobs.ts";
import { migrate } from "./migrate.ts";
import { createProject, getProject, type Owner, ProjectError, updateProject } from "./projects.ts";
import { useTestDatabase } from "./testing/database.ts";
import { ensureWorkspace } from "./workspaces.ts";

const database = useTestDatabase();
const db = () => database.get();

beforeAll(async () => {
  await migrate(db());
});

async function setup(): Promise<Owner & { workspace: Workspace; projectId: ObjectId }> {
  const userId = new ObjectId();
  const workspace = await ensureWorkspace(db(), { id: userId, name: "Asha Rao" });
  const owner = { userId, workspaceId: workspace._id };
  const project = await createProject(
    db(),
    owner,
    workspace,
    createProjectInput.parse({ topic: "How UPI works" }),
  );
  return { ...owner, workspace, projectId: project._id };
}

const angles = [
  {
    id: "ang_a",
    title: "The journey",
    hook: "Here is how it moves.",
    outline: ["App", "NPCI", "Bank"],
  },
  { id: "ang_b", title: "Three myths", hook: "Let's clear these up.", outline: ["Balance", "PIN"] },
];

describe("AI requests per video", () => {
  it("counts up to the limit, even with parallel requests, then refuses with the numbers", async () => {
    const o = await setup();
    const results = await Promise.allSettled(
      Array.from({ length: 5 }, () => reserveGeneration(db(), o, o.projectId, 3)),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(3);
    const refused = results.find((r) => r.status === "rejected")?.reason as JobError;
    expect(refused).toBeInstanceOf(JobError);
    expect(refused.code).toBe("LIMIT_REACHED");
    expect(refused.details).toEqual({
      limit: "generationsPerVideo",
      used: 3,
      max: 3,
      resetsAt: null,
    });
    expect((await getProject(db(), o.workspaceId, o.projectId)).generationsUsed).toBe(3);
  });

  it("finishing gives a failed or cancelled job's request back once; a succeeded job keeps it", async () => {
    const o = await setup();
    const used = async () => (await getProject(db(), o.workspaceId, o.projectId)).generationsUsed;
    const start = async () => {
      await reserveGeneration(db(), o, o.projectId, 50);
      const job = await createJob(db(), o, o.workspace, {
        type: "ideas",
        projectId: o.projectId,
        input: {},
        reservesGeneration: true,
      });
      return { workspaceId: o.workspaceId, jobId: job._id };
    };

    const failed = await start();
    const error = { code: "LLM_UNAVAILABLE", message: "x", retryable: true };
    await finishJob(db(), failed, { status: "failed", error });
    await finishJob(db(), failed, { status: "failed", error }); // a retried step
    expect(await releaseJobGeneration(db(), failed)).toBe(false);
    expect(await used()).toBe(0);

    const cancelled = await start();
    await finishJob(db(), cancelled, { status: "cancelled" });
    expect(await used()).toBe(0);

    const ok = await start();
    await finishJob(db(), ok, { status: "succeeded", result: { type: "ideas" } });
    expect(await releaseJobGeneration(db(), ok)).toBe(false);
    expect(await used()).toBe(1);
  });

  it("refuses another workspace's project as not found", async () => {
    const o = await setup();
    const stranger = await setup();
    await expect(reserveGeneration(db(), stranger, o.projectId, 50)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

describe("angles", () => {
  it("replace the old angles, clear the pick and move the wizard to angles", async () => {
    const o = await setup();
    const job = await createJob(db(), o, o.workspace, {
      type: "ideas",
      projectId: o.projectId,
      input: {},
    });
    const ref = { workspaceId: o.workspaceId, jobId: job._id, projectId: o.projectId };
    expect(await saveAngles(db(), ref, angles)).toBe(true);
    await updateProject(
      db(),
      o,
      o.projectId,
      updateProjectInput.parse({ idea: { selectedAngleId: "ang_b" } }),
    );

    const fresh = [{ ...angles[0]!, id: "ang_c" }];
    expect(await saveAngles(db(), ref, fresh)).toBe(true);
    const project = await getProject(db(), o.workspaceId, o.projectId);
    expect(project.idea.angles.map((a) => a.id)).toEqual(["ang_c"]);
    expect(project.idea.selectedAngleId).toBeUndefined();
    expect(project.wizardStep).toBe("angles");
    expect((await readIdeaInputs(db(), o.workspaceId, o.projectId))?.idea.topic).toBe(
      "How UPI works",
    );
  });

  it("aren't saved by a job that no longer holds the project", async () => {
    const o = await setup();
    const job = await createJob(db(), o, o.workspace, {
      type: "ideas",
      projectId: o.projectId,
      input: {},
    });
    await finishJob(db(), { workspaceId: o.workspaceId, jobId: job._id }, { status: "cancelled" });
    expect(
      await saveAngles(
        db(),
        { workspaceId: o.workspaceId, jobId: job._id, projectId: o.projectId },
        angles,
      ),
    ).toBe(false);
    expect((await getProject(db(), o.workspaceId, o.projectId)).idea.angles).toEqual([]);
  });

  it("must exist to be picked; null clears the pick", async () => {
    const o = await setup();
    const job = await createJob(db(), o, o.workspace, {
      type: "ideas",
      projectId: o.projectId,
      input: {},
    });
    await saveAngles(
      db(),
      { workspaceId: o.workspaceId, jobId: job._id, projectId: o.projectId },
      angles,
    );
    const error = await updateProject(
      db(),
      o,
      o.projectId,
      updateProjectInput.parse({ idea: { selectedAngleId: "nope" } }),
    ).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ProjectError);
    expect((error as ProjectError).details).toMatchObject({ needs: "angles" });

    await updateProject(
      db(),
      o,
      o.projectId,
      updateProjectInput.parse({ idea: { selectedAngleId: "ang_a" } }),
    );
    await updateProject(
      db(),
      o,
      o.projectId,
      updateProjectInput.parse({ idea: { selectedAngleId: null } }),
    );
    expect(
      (await getProject(db(), o.workspaceId, o.projectId)).idea.selectedAngleId,
    ).toBeUndefined();
  });
});
