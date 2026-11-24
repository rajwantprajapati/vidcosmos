"use client";

// Step 4 of making a video (Generating design, API §7): the generation's progress. The stages
// as a list (the storyboard, recording narration with each scene's status, timing, saving),
// the progress bar with what is happening now, and the scenes filling in on a phone-shaped
// preview as their narration is recorded. It follows the job with `useJob`:
// - succeeded: opens the editor;
// - partial: says which scenes have no narration, with "Retry these scenes";
// - failed or cancelled: says why, with "Try again" (a new generation over the draft).
// Phones get the create steps' own header and a sticky bottom button (no design exists).
import { isJobFinished, type JobDto, type ProjectDetailDto } from "@vidcosmos/spec/api";
import { sceneHeadline, type VideoSpec } from "@vidcosmos/spec/video";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useJob } from "@/components/jobs/use-job";
import { Badge, Button, buttonClassName, cn, Icon, ProgressBar } from "@/components/ui";
import { apiFetch, ApiRequestError } from "@/lib/api-client";
import { Notice } from "./notice";
import { StepBars, Stepper } from "./stepper";
import { getEditorId } from "./use-edit-lease";

type SceneStatus = NonNullable<JobDto["scenes"]>[number]["status"];

const sceneWord: Record<SceneStatus, string> = {
  pending: "Waiting",
  running: "Recording",
  done: "Recorded",
  skipped: "Reused",
  failed: "Failed",
};

const sceneDot: Record<SceneStatus, string> = {
  pending: "bg-line-strong",
  running: "bg-brand-text",
  done: "bg-success",
  skipped: "bg-success",
  failed: "bg-danger",
};

type StageState = "done" | "now" | "next" | "failed";

/** Which of the four stages is done, under way or still to come. */
function stagesOf(job: JobDto): [StageState, StageState, StageState, StageState] {
  if (job.status === "succeeded" || job.status === "partial") {
    return ["done", "done", "done", "done"];
  }
  const failed = job.status === "failed" || job.status === "cancelled";
  const at = job.stage === "timing" ? 2 : job.stage === "save" ? 3 : 1;
  return [0, 1, 2, 3].map((i) =>
    i === 0 || i < at ? "done" : i === at ? (failed ? "failed" : "now") : "next",
  ) as [StageState, StageState, StageState, StageState];
}

function StageMark({ state }: { state: StageState }) {
  if (state === "done") {
    return (
      <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-success-soft text-success">
        <Icon name="check" size={16} />
      </span>
    );
  }
  if (state === "now") {
    return (
      <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-brand text-on-brand">
        <Icon name="loader" size={16} />
      </span>
    );
  }
  if (state === "failed") {
    return (
      <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-danger-soft text-danger">
        <Icon name="x" size={16} />
      </span>
    );
  }
  return <span className="size-7 shrink-0 rounded-full border border-line-strong" />;
}

export type GeneratingStepProps = {
  project: ProjectDetailDto;
  job: JobDto;
  /** "Female voice · English". */
  voiceLabel: string;
};

export function GeneratingStep({ project, job: initial, voiceLabel }: GeneratingStepProps) {
  const router = useRouter();
  const [job, setJob] = useJob(initial);
  const [busy, setBusy] = useState<"cancel" | "retry" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const projectId = project.id;
  const spec = project.draft.spec as VideoSpec | null;
  const scenes = spec?.scenes ?? [];
  const finished = isJobFinished(job.status);
  // The version the run saved once it's finished (the current one, when nothing changed);
  // the next one while it runs.
  const savedVersion =
    typeof job.result?.versionNumber === "number" ? job.result.versionNumber : null;
  const versionNumber = savedVersion ?? (project.currentVersion ?? 0) + 1;

  // A finished generation opens the editor; a partial one stays to offer the retry.
  useEffect(() => {
    if (job.status === "succeeded") router.replace(`/projects/${projectId}`);
  }, [job.status, projectId, router]);

  const statusOf = (sceneId: string): SceneStatus =>
    job.scenes?.find((scene) => scene.sceneId === sceneId)?.status ?? "pending";
  const recorded = (job.scenes ?? []).filter(
    (scene) => scene.status === "done" || scene.status === "skipped",
  ).length;
  const failedIds = (job.scenes ?? [])
    .filter((scene) => scene.status === "failed")
    .map((scene) => scene.sceneId);
  const stages = stagesOf(job);

  async function cancel() {
    setBusy("cancel");
    setError(null);
    try {
      setJob(await apiFetch<JobDto>(`/jobs/${job.id}/cancel`, { method: "POST" }));
    } catch (failure) {
      setError(
        failure instanceof ApiRequestError ? failure.message : "Couldn't stop it. Try again.",
      );
    } finally {
      setBusy(null);
    }
  }

  /** A new generation over the draft as it is, or a recording of the failed scenes. */
  async function retry(scenesOnly: boolean) {
    setBusy("retry");
    setError(null);
    try {
      const fresh = await apiFetch<ProjectDetailDto>(`/projects/${projectId}`);
      const started = await apiFetch<JobDto>(
        `/projects/${projectId}/${scenesOnly ? "narration" : "generate"}`,
        {
          method: "POST",
          idempotent: true,
          editorId: getEditorId(),
          body: scenesOnly
            ? { baseRev: fresh.draft.rev, sceneIds: failedIds }
            : { baseRev: fresh.draft.rev },
        },
      );
      setJob(started);
      heading.current?.focus();
    } catch (failure) {
      setError(failure instanceof ApiRequestError ? failure.message : "Couldn't start. Try again.");
    } finally {
      setBusy(null);
    }
  }

  const title =
    job.status === "partial"
      ? "Your video is almost ready"
      : job.status === "failed"
        ? "We couldn’t make your video"
        : job.status === "cancelled"
          ? "Generation stopped"
          : "Making your video";
  const lede =
    job.status === "partial"
      ? `${failedIds.length === 1 ? "One scene has" : `${failedIds.length} scenes have`} no narration yet. The rest is saved as version ${versionNumber}; retry just ${failedIds.length === 1 ? "that scene" : "those scenes"}.`
      : job.status === "failed"
        ? (job.error?.message ?? "Something went wrong. Try again.")
        : job.status === "cancelled"
          ? "Nothing was saved, and this video wasn’t counted. Your storyboard is as you left it."
          : "This usually takes about a minute. You can leave this page; we’ll let you know when it’s ready.";
  const barLabel =
    job.status === "partial"
      ? `Recorded ${recorded} of ${job.scenes?.length ?? scenes.length} scenes`
      : finished
        ? (job.message ?? "Stopped")
        : job.status === "queued"
          ? "Waiting to start"
          : (job.message ?? "Working");
  const canRetryAll =
    job.status === "cancelled" || (job.status === "failed" && job.error?.retryable);

  const primary = (phone: boolean) => {
    if (job.status === "partial") {
      return (
        <Button
          size={phone ? "lg" : "md"}
          fullWidth={phone}
          loading={busy === "retry"}
          disabled={busy !== null}
          onClick={() => void retry(true)}
        >
          Retry {failedIds.length === 1 ? "this scene" : "these scenes"}
        </Button>
      );
    }
    if (canRetryAll) {
      return (
        <Button
          size={phone ? "lg" : "md"}
          fullWidth={phone}
          loading={busy === "retry"}
          disabled={busy !== null}
          onClick={() => void retry(false)}
        >
          Try again
        </Button>
      );
    }
    return (
      <Link
        href="/"
        className={buttonClassName({
          variant: "secondary",
          size: phone ? "lg" : "md",
          fullWidth: phone,
          className: phone ? undefined : "min-h-11 rounded-[10px] px-[18px]",
        })}
      >
        Back to library
      </Link>
    );
  };

  return (
    <div className="-mx-4 -mt-1 flex flex-1 flex-col md:-mx-10 md:-mt-7 md:-mb-12">
      {/* Phones: a full screen with its own header, like the other steps. */}
      <div className="flex flex-col gap-2 pb-2 md:hidden">
        <header className="flex h-14 items-center gap-1 pr-3 pl-1">
          <Link
            href="/"
            aria-label="Library"
            className="inline-flex size-11 items-center justify-center rounded-[12px] text-ink-secondary"
          >
            <ChevronLeft aria-hidden="true" size={22} strokeWidth={1.75} />
          </Link>
          <span className="m-0 flex-1 font-display text-[17px] font-extrabold">Video</span>
          <span className="text-[13px] text-ink-muted tabular-nums">Step 4 of 4</span>
        </header>
        <StepBars step={4} />
      </div>

      {/* Desktop: the header bar with the stepper. */}
      <header className="hidden flex-wrap items-center justify-between gap-4 border-b border-line bg-surface px-10 py-4 md:flex">
        <div className="flex min-w-[200px] flex-[1_1_0] flex-col gap-0.5">
          <Link href="/" className="text-[13px] font-semibold text-brand-text no-underline">
            ← Library
          </Link>
          <p
            title={project.title}
            className="m-0 truncate font-display text-[24px] leading-[30px] font-extrabold tracking-[-0.02em]"
          >
            {project.title}
          </p>
        </div>
        <Stepper step={4} className="py-4" />
        <div className="flex w-[112px] shrink-0 justify-end">
          {finished ? null : <Badge tone="brand">Generating</Badge>}
        </div>
      </header>

      <div className="flex flex-1 flex-wrap justify-center gap-12 px-4 pt-4 pb-28 md:px-10 md:py-12">
        {/* The scenes filling in, on a phone-shaped preview. */}
        <div
          aria-hidden="true"
          className="hidden w-[300px] flex-none flex-col items-center gap-3.5 md:flex"
        >
          <div className="grid h-[533px] w-[300px] auto-rows-[minmax(0,1fr)] grid-cols-2 gap-2.5 rounded-[24px] bg-stage p-3.5">
            {scenes.map((scene) => {
              const status = statusOf(scene.id);
              const ready = status === "done" || status === "skipped";
              const now = status === "running";
              return (
                <div
                  key={scene.id}
                  className={cn(
                    "flex flex-col justify-between rounded-[10px] p-2 text-[10px] font-bold text-[var(--video-midnight-text)]",
                    ready
                      ? "bg-[var(--video-midnight-bg)]"
                      : now
                        ? "bg-[var(--video-midnight-panel)]"
                        : "bg-[color-mix(in_srgb,var(--video-midnight-text)_8%,transparent)]",
                    !ready && !now && !finished && "vc-waiting",
                  )}
                >
                  <span className="line-clamp-3">{sceneHeadline(scene) || "Scene"}</span>
                  <span className="text-[9px] font-semibold opacity-80">
                    {ready
                      ? "Narration ready"
                      : now
                        ? "Recording…"
                        : status === "failed"
                          ? "No narration"
                          : ""}
                  </span>
                </div>
              );
            })}
          </div>
          <span className="text-[13px] text-ink-muted">
            Scenes fill in as their narration is recorded
          </span>
        </div>

        <section
          aria-labelledby="gen-h"
          className="flex max-w-[560px] min-w-0 flex-[1_1_420px] flex-col gap-6"
        >
          <div className="flex flex-col gap-2">
            <h1
              id="gen-h"
              ref={heading}
              tabIndex={-1}
              className="m-0 font-display text-[26px] leading-[32px] font-extrabold tracking-[-0.025em] outline-none md:text-[32px] md:leading-[38px]"
            >
              {title}
            </h1>
            <p className="m-0 text-[16px] leading-[25px] text-ink-secondary">{lede}</p>
          </div>

          <ProgressBar
            value={job.progress}
            label={barLabel}
            live
            tone={
              job.status === "failed" ? "danger" : job.status === "cancelled" ? "neutral" : "brand"
            }
          />

          <ol className="m-0 flex list-none flex-col overflow-hidden rounded-[16px] border border-line bg-surface p-0">
            <li className="flex items-center gap-3.5 border-b border-line px-[18px] py-4">
              <StageMark state={stages[0]} />
              <span className="flex-1 font-semibold">Script and storyboard</span>
              <span className="text-[13px] text-ink-muted tabular-nums">
                {scenes.length} scenes
              </span>
            </li>
            <li
              className={cn(
                "flex flex-col gap-2.5 border-b border-line px-[18px] py-4",
                stages[1] === "now" && "bg-brand-soft",
              )}
            >
              <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1">
                <StageMark state={stages[1]} />
                <span className="flex-1 font-semibold">Recording narration</span>
                <span className="w-full pl-[42px] text-[13px] text-ink-secondary md:w-auto md:pl-0">
                  {voiceLabel}
                </span>
              </div>
              <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-x-3 gap-y-1.5 p-0 text-[13px] md:grid-cols-[repeat(auto-fill,minmax(120px,1fr))] md:pl-[42px]">
                {scenes.map((scene, i) => {
                  const status = statusOf(scene.id);
                  return (
                    <li
                      key={scene.id}
                      className={cn(
                        "inline-flex items-center gap-1.5 whitespace-nowrap",
                        status === "pending" ? "text-ink-muted" : "text-ink",
                        status === "failed" && "text-danger",
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className={cn("size-2 rounded-full", sceneDot[status])}
                      />
                      Scene {i + 1} · {sceneWord[status]}
                    </li>
                  );
                })}
              </ul>
            </li>
            <li
              className={cn(
                "flex items-center gap-3.5 border-b border-line px-[18px] py-4",
                stages[2] === "next" && "text-ink-muted",
                stages[2] === "now" && "bg-brand-soft",
              )}
            >
              <StageMark state={stages[2]} />
              <span className="flex-1 font-semibold">Timing every visual to its word</span>
            </li>
            <li
              className={cn(
                "flex items-center gap-3.5 px-[18px] py-4",
                stages[3] === "next" && "text-ink-muted",
                stages[3] === "now" && "bg-brand-soft",
              )}
            >
              <StageMark state={stages[3]} />
              <span className="flex-1 font-semibold">
                {savedVersion !== null ? "Saved" : "Saving"} version {versionNumber}
              </span>
            </li>
          </ol>

          {error ? <Notice>{error}</Notice> : null}

          <div className="hidden flex-wrap items-center gap-3 md:flex">
            {primary(false)}
            {finished ? (
              job.status === "partial" ? (
                <Link
                  href={`/projects/${projectId}`}
                  className={buttonClassName({ variant: "ghost" })}
                >
                  Open the editor
                </Link>
              ) : (
                <Link
                  href={`/projects/${projectId}/storyboard`}
                  className={buttonClassName({ variant: "ghost" })}
                >
                  Back to storyboard
                </Link>
              )
            ) : (
              <Button
                variant="ghost"
                loading={busy === "cancel"}
                disabled={busy !== null || !job.cancellable}
                onClick={() => void cancel()}
              >
                Cancel
              </Button>
            )}
          </div>
          <p className="m-0 text-[13px] text-ink-muted">
            If a scene fails, the rest of the video is still saved and you can retry just that
            scene.
          </p>
        </section>
      </div>

      {/* Phones: the next thing to do, kept at the bottom. */}
      <div className="fixed inset-x-0 bottom-0 z-10 flex flex-col gap-2 border-t border-line bg-surface px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] md:hidden">
        {primary(true)}
        {job.status === "partial" ? (
          <Link
            href={`/projects/${projectId}`}
            className={buttonClassName({ variant: "ghost", fullWidth: true })}
          >
            Open the editor
          </Link>
        ) : null}
        {finished ? null : (
          <Button
            variant="ghost"
            fullWidth
            loading={busy === "cancel"}
            disabled={busy !== null || !job.cancellable}
            onClick={() => void cancel()}
          >
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}
