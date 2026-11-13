// Development only (F11): start the demo job on one of your videos and watch it run through
// Inngest. Shows the jobs that are still running, so a reload picks them up again. Needs the
// Inngest Dev Server (`pnpm inngest`). 404 in production.
import { listJobs, listProjects } from "@vidcosmos/db";
import { listJobsQuery, listProjectsQuery, toJobDto } from "@vidcosmos/spec/api";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { DemoJobs } from "./demo-jobs";

export const metadata: Metadata = { title: "Jobs · Vidcosmos" };
export const dynamic = "force-dynamic";

export default async function DevJobsPage() {
  if (process.env.NODE_ENV === "production") notFound();
  const { workspace } = await requireSession("/dev/jobs");
  const db = getDb();
  const [projects, active] = await Promise.all([
    listProjects(db, workspace._id, listProjectsQuery.parse({ limit: "100" })),
    listJobs(db, workspace._id, listJobsQuery.parse({ active: "true", limit: "50" })),
  ]);

  return (
    <main className="mx-auto flex max-w-reading flex-col gap-6 px-4 py-10 md:px-10">
      <header className="flex flex-col gap-2">
        <h1 className="h1 m-0">Jobs</h1>
        <p className="body m-0 text-ink-secondary">
          A demo job with fake steps, run by Inngest. Start the Inngest Dev Server with{" "}
          <code>pnpm inngest</code>; its dashboard is on{" "}
          <a className="text-brand-text underline" href="http://localhost:8288">
            localhost:8288
          </a>
          .
        </p>
      </header>
      {projects.items.length === 0 ? (
        <p className="body m-0">
          A job runs on a video.{" "}
          <Link className="text-brand-text underline" href="/projects/new">
            Make a video
          </Link>{" "}
          first.
        </p>
      ) : (
        <DemoJobs
          projects={projects.items.map((p) => ({ id: p._id.toHexString(), title: p.title }))}
          activeJobs={active.items.map(toJobDto)}
        />
      )}
    </main>
  );
}
