"use client";

// A background job's progress (API §11, Generating design): what is happening now, the
// percentage, and Cancel while it runs; when it fails with a retryable error, "Try again"
// starts a new job with the same input. It keeps itself up to date with `useJob`.
import { isJobFinished, type JobDto } from "@vidcosmos/spec/api";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { Badge, type BadgeTone, Button, Icon, ProgressBar } from "@/components/ui";
import { apiFetch, ApiRequestError } from "@/lib/api-client";
import { useJob } from "./use-job";

const statusBadge: Record<JobDto["status"], { tone: BadgeTone; label: string }> = {
  queued: { tone: "neutral", label: "Waiting" },
  running: { tone: "brand", label: "Running" },
  succeeded: { tone: "success", label: "Done" },
  partial: { tone: "warning", label: "Partly done" },
  failed: { tone: "danger", label: "Failed" },
  cancelled: { tone: "neutral", label: "Cancelled" },
};

/** The bar's colour: brand while it runs or once it's done, danger when it failed, neutral when it stopped. */
const barTone = (job: JobDto) =>
  job.status === "failed"
    ? "danger"
    : job.status === "cancelled" || job.status === "partial"
      ? "neutral"
      : "brand";

/**
 * What the bar's label says. The badge already says the status, so a finished job's label says
 * where it got to rather than repeating it.
 */
export function jobLabel(job: JobDto): string {
  if (job.status === "succeeded") return "All steps finished";
  if (job.status === "partial") return "Finished, with some parts missing";
  if (job.status === "failed" || job.status === "cancelled") {
    return job.message ? `Stopped during: ${job.message}` : "Stopped before it began";
  }
  if (!job.cancellable) return "Stopping…";
  if (job.status === "queued") return "Waiting to start";
  return job.message ?? "Working";
}

export type JobProgressProps = {
  job: JobDto;
  /** Shown above the bar, e.g. the video's title. */
  title?: ReactNode;
  /** A retry started a new job: the parent shows it in place of this one. */
  onRetry?: (job: JobDto) => void;
  /** Move keyboard focus to this job's title when it appears (the job a retry started). */
  focusOnMount?: boolean;
};

export function JobProgress({ job: initial, title, onRetry, focusOnMount }: JobProgressProps) {
  const [job, setJob] = useJob(initial);
  const [busy, setBusy] = useState<"cancel" | "retry" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const finished = isJobFinished(job.status);
  const badge = statusBadge[job.status];
  const label = jobLabel(job);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (focusOnMount) heading.current?.focus();
  }, [focusOnMount]);

  async function cancel() {
    setBusy("cancel");
    setError(null);
    try {
      setJob(await apiFetch<JobDto>(`/jobs/${job.id}/cancel`, { method: "POST" }));
      // The Cancel button goes away: keep focus on this job rather than the page.
      heading.current?.focus();
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : "Couldn't stop it. Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function retry() {
    setBusy("retry");
    setError(null);
    try {
      const next = await apiFetch<JobDto>(`/jobs/${job.id}/retry`, {
        method: "POST",
        idempotent: true,
      });
      onRetry?.(next);
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : "Couldn't start it again. Try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <article
      aria-labelledby={`job-${job.id}-title`}
      data-job-id={job.id}
      data-status={job.status}
      className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-5"
    >
      <div className="flex items-center justify-between gap-3">
        <h3
          id={`job-${job.id}-title`}
          ref={heading}
          tabIndex={-1}
          className="m-0 min-w-0 truncate text-[16px] leading-6 font-semibold text-ink"
        >
          {title ?? "Job"}
        </h3>
        <Badge tone={badge.tone}>{badge.label}</Badge>
      </div>
      <ProgressBar value={job.progress} label={label} live tone={barTone(job)} />
      {job.status === "failed" && job.error ? (
        <p role="alert" className="m-0 flex items-start gap-2 text-[14px] leading-5 text-ink">
          <Icon name="alert" size={18} className="mt-px shrink-0 text-danger" />
          {job.error.message}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="m-0 text-[14px] leading-5 text-danger">
          {error}
        </p>
      ) : null}
      {!finished && job.cancellable ? (
        <div>
          <Button variant="ghost" loading={busy === "cancel"} onClick={cancel}>
            {busy === "cancel" ? "Cancelling…" : "Cancel"}
          </Button>
        </div>
      ) : null}
      {job.status === "failed" && job.error?.retryable ? (
        <div>
          <Button variant="secondary" loading={busy === "retry"} onClick={retry}>
            {busy === "retry" ? "Starting again…" : "Try again"}
          </Button>
        </div>
      ) : null}
    </article>
  );
}
