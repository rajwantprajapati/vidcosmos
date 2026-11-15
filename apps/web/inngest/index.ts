// Every Inngest function the app serves at /api/inngest, wired to the real job store.
import "server-only";
import { ObjectId } from "@vidcosmos/db";
import { getDb } from "@/lib/db";
import { getLlm, recordLlmUsage } from "@/lib/llm";
import { inngest } from "./client";
import { createDemoJob } from "./functions/demo-job";
import { createJobCancelled } from "./functions/job-cancelled";
import { createSuggestIdeas } from "./functions/suggest-ideas";
import { mongoIdeasStore } from "./ideas-store";
import { mongoJobStore } from "./job-store";

const store = mongoJobStore(getDb);

export const functions = [
  createDemoJob(inngest, store, { pause: "1s" }),
  createJobCancelled(inngest, store),
  createSuggestIdeas(inngest, {
    jobs: store,
    ideas: mongoIdeasStore(getDb),
    llm: () => getLlm("main"),
    small: () => getLlm("small"),
    usage: (job, userId, operation) =>
      recordLlmUsage(
        {
          workspaceId: new ObjectId(job.workspaceId),
          userId: new ObjectId(userId),
          projectId: new ObjectId(job.projectId),
          jobId: new ObjectId(job.jobId),
        },
        operation,
      ),
  }),
];

export { inngest };
