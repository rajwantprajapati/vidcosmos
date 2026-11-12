"use client";

// Follows one job until it finishes (SDD §4 "Job progress"): `GET /jobs/{id}` every 1.5 s while
// the tab is visible, every 10 s while it's hidden, and at once when it becomes visible again.
// The ETag makes an unchanged job a bodiless 304. Polling stops when the job finishes.
import { isJobFinished, type JobDto } from "@vidcosmos/spec/api";
import { useEffect, useRef, useState } from "react";

export const pollVisibleMs = 1_500;
export const pollHiddenMs = 10_000;

export function useJob(initial: JobDto): [JobDto, (job: JobDto) => void] {
  const [job, setJob] = useState(initial);
  const etag = useRef<string | null>(null);
  const finished = isJobFinished(job.status);

  useEffect(() => {
    if (finished) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;

    const poll = async () => {
      try {
        const response = await fetch(`/api/v1/jobs/${job.id}`, {
          headers: etag.current ? { "If-None-Match": etag.current } : {},
        });
        if (response.ok) {
          etag.current = response.headers.get("etag");
          const next = (await response.json()) as JobDto;
          if (!stopped) setJob(next);
        }
      } catch {
        // Offline for a moment: try again on the next tick.
      }
      schedule();
    };
    const schedule = () => {
      if (stopped) return;
      clearTimeout(timer);
      timer = setTimeout(poll, document.hidden ? pollHiddenMs : pollVisibleMs);
    };
    const onVisible = () => {
      if (!document.hidden) {
        clearTimeout(timer);
        void poll();
      }
    };

    schedule();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [job.id, finished]);

  return [job, setJob];
}
