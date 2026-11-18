// Every Inngest function the app serves at /api/inngest, wired to the real job store.
import "server-only";
import { ObjectId } from "@vidcosmos/db";
import { getDb } from "@/lib/db";
import { getLlm, recordLlmUsage } from "@/lib/llm";
import { inngest } from "./client";
import { createDemoJob } from "./functions/demo-job";
import { createJobCancelled } from "./functions/job-cancelled";
import { createRewriteScript, createWriteScript } from "./functions/script-jobs";
import { createBuildStoryboard } from "./functions/storyboard-jobs";
import { createSuggestIdeas } from "./functions/suggest-ideas";
import { mongoIdeasStore } from "./ideas-store";
import { mongoJobStore } from "./job-store";
import { mongoScriptStore } from "./script-store";
import { mongoStoryboardStore } from "./storyboard-store";
import { voiceIds } from "@/lib/voices";

const store = mongoJobStore(getDb);

/** Records each LLM call of a project job as a usage event. */
const usageFor = (
  job: { workspaceId: string; projectId: string; jobId: string },
  userId: string,
  operation: Parameters<typeof recordLlmUsage>[1],
) =>
  recordLlmUsage(
    {
      workspaceId: new ObjectId(job.workspaceId),
      userId: new ObjectId(userId),
      projectId: new ObjectId(job.projectId),
      jobId: new ObjectId(job.jobId),
    },
    operation,
  );

const scriptDeps = {
  jobs: store,
  scripts: mongoScriptStore(getDb),
  llm: () => getLlm("main"),
  small: () => getLlm("small"),
  usage: usageFor,
};

export const functions = [
  createDemoJob(inngest, store, { pause: "1s" }),
  createJobCancelled(inngest, store),
  createSuggestIdeas(inngest, {
    jobs: store,
    ideas: mongoIdeasStore(getDb),
    llm: () => getLlm("main"),
    small: () => getLlm("small"),
    usage: usageFor,
  }),
  createWriteScript(inngest, scriptDeps),
  createRewriteScript(inngest, scriptDeps),
  createBuildStoryboard(inngest, {
    jobs: store,
    storyboards: mongoStoryboardStore(getDb, voiceIds),
    llm: () => getLlm("main"),
    small: () => getLlm("small"),
    usage: usageFor,
  }),
];

export { inngest };
