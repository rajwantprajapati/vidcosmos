"use client";

// Start the demo job, then follow it and every other running job with JobProgress.
import type { DemoJobMode, JobDto } from "@vidcosmos/spec/api";
import { type FormEvent, useState } from "react";
import { JobProgress } from "@/components/jobs/job-progress";
import { Button, SegmentedControl } from "@/components/ui";
import { apiFetch, ApiRequestError } from "@/lib/api-client";

const modes: { value: DemoJobMode; label: string }[] = [
  { value: "succeed", label: "Succeeds" },
  { value: "fail_once", label: "Fails once" },
  { value: "fail", label: "Fails" },
];

type Project = { id: string; title: string };

export function DemoJobs({ projects, activeJobs }: { projects: Project[]; activeJobs: JobDto[] }) {
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [mode, setMode] = useState<DemoJobMode>("succeed");
  const [jobs, setJobs] = useState(activeJobs);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retried, setRetried] = useState<string | null>(null);
  const titleOf = (id: string | null) => projects.find((p) => p.id === id)?.title ?? "Job";

  async function start(event: FormEvent) {
    event.preventDefault();
    setStarting(true);
    setError(null);
    try {
      const job = await apiFetch<JobDto>("/api/dev/jobs/demo", {
        method: "POST",
        body: { projectId, mode },
        idempotent: true,
      });
      setJobs((all) => [job, ...all.filter((j) => j.id !== job.id)]);
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : "Couldn't start the job. Try again.");
    } finally {
      setStarting(false);
    }
  }

  return (
    <>
      <form
        onSubmit={start}
        className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-5"
      >
        <div className="flex flex-col gap-1.5">
          <label htmlFor="demo-project" className="label text-ink">
            Video
          </label>
          <select
            id="demo-project"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="min-h-11 rounded-[10px] border border-line-strong bg-surface px-3 text-[15px] text-ink"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="label text-ink">How it ends</span>
          <SegmentedControl
            label="How it ends"
            options={modes}
            value={mode}
            onChange={(value) => setMode(value as DemoJobMode)}
          />
        </div>
        {error ? (
          <p role="alert" className="m-0 text-[14px] leading-5 text-danger">
            {error}
          </p>
        ) : null}
        <div>
          <Button type="submit" loading={starting}>
            {starting ? "Starting…" : "Start demo job"}
          </Button>
        </div>
      </form>
      <section aria-labelledby="jobs-h" className="flex flex-col gap-3">
        <h2 id="jobs-h" className="h3 m-0">
          Jobs
        </h2>
        {jobs.length === 0 ? (
          <p className="body m-0 text-ink-muted">Nothing is running.</p>
        ) : (
          jobs.map((job) => (
            <JobProgress
              key={job.id}
              job={job}
              title={titleOf(job.projectId)}
              focusOnMount={job.id === retried}
              onRetry={(next) => {
                setRetried(next.id);
                setJobs((all) => [next, ...all.filter((j) => j.id !== job.id)]);
              }}
            />
          ))
        )}
      </section>
    </>
  );
}
