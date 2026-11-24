"use client";

// Step 3 of making a video (Storyboard and MobileStoryboard designs, PRD M3, API §5-6): the
// script split into scenes. Each card shows what the narrator says, with the words each visual
// waits for highlighted, and what appears on screen. The template picker and the edit panel
// change a scene; changes are saved with the draft's `rev` (one save every 1.5 s at most).
// The rules are checked here as you type, with the server's own check on save: a trigger the
// narrator never says marks its scene and the banner names it, and Generate waits until it's
// fixed. "Rebuild storyboard" makes new scenes from the script (asked first: it replaces them).
//
// Step 2's "Build the storyboard" starts the first one and opens this step, which picks the
// running job up. Opened without a storyboard and without a job, it offers to build one.
// Generate starts the generation (API §7) and opens the Generating screen.
import type { DraftSavedDto, JobDto, ProjectDetailDto } from "@vidcosmos/spec/api";
import {
  convertScene,
  estimatedVideoMs,
  type Scene,
  sceneElements,
  type SpecIssue,
  specIssues,
  type TemplateName,
  type VideoSpec,
} from "@vidcosmos/spec/video";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useJob } from "@/components/jobs/use-job";
import { Button, cn, Icon, ProgressBar } from "@/components/ui";
import { apiFetch, ApiRequestError } from "@/lib/api-client";
import { Modal } from "./modal";
import { Notice } from "./notice";
import { SceneCard, SceneRow } from "./scene-card";
import { SceneEditor } from "./scene-editor";
import { StepBars, Stepper } from "./stepper";
import { useEditLease } from "./use-edit-lease";

/** At most one draft save every 1.5 s while editing (API §5). */
const autosaveMs = 1_500;

export type StoryboardUsage = {
  max: number;
  remaining: number;
  reached: boolean;
  /** This video already counts this month: generating again uses no more. */
  counted: boolean;
  resetsOn: string;
};

export type StoryboardStepProps = {
  project: ProjectDetailDto;
  /** The running storyboard job, or the last one if it failed. */
  job: JobDto | null;
  usage: StoryboardUsage;
};

type SaveState = "idle" | "saving" | "saved" | "failed";

const leaseLostMessage = "Another tab took over editing, so your last change wasn’t saved here.";

const isActive = (job: JobDto | null) =>
  Boolean(job && (job.status === "queued" || job.status === "running"));

/** What the banner says about an issue, naming the element and its words. */
function issueText(issue: SpecIssue, scene: Scene | undefined): string {
  if (issue.code === "TRIGGER_NOT_IN_NARRATION" && scene && issue.path) {
    const element = sceneElements(scene).find((e) => e.path === issue.path);
    if (element) {
      return `“${element.label}” waits for the words “${element.trigger}”, but the narrator never says them. Change the words it appears on, or edit the narration.`;
    }
  }
  return issue.message;
}

export function StoryboardStep({ project, job: initialJob, usage }: StoryboardStepProps) {
  const router = useRouter();
  const projectId = project.id;
  const lease = useEditLease(projectId);
  const { editorId: tabId, lost: leaseLost } = lease;

  const [title, setTitle] = useState(project.title);
  const [spec, setSpec] = useState<VideoSpec | null>(project.draft.spec);
  const [savedSpec, setSavedSpec] = useState<VideoSpec | null>(project.draft.spec);
  const [rev, setRev] = useState(project.draft.rev);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [stale, setStale] = useState(project.stale.storyboard);
  const [used, setUsed] = useState(project.counters.generationsUsed);
  const [job, setJob] = useState<JobDto | null>(initialJob);
  const [busy, setBusy] = useState<"build" | "generate" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [confirmRebuild, setConfirmRebuild] = useState(false);
  const [reloading, setReloading] = useState(false);
  /** The save in flight, so Generate can wait for it. */
  const saving = useRef<Promise<boolean> | null>(null);

  const readOnly = lease.state.status === "elsewhere" || reloading;
  const working = isActive(job);
  const outOfRequests = used >= project.counters.generationsMax;
  const canAsk = !readOnly && !working && !outOfRequests && busy === null;
  const dirty = spec !== savedSpec;

  const issues = useMemo(() => (spec ? specIssues(spec) : []), [spec]);
  const issuesBy = useMemo(() => {
    const map = new Map<string, SpecIssue[]>();
    for (const issue of issues) {
      if (!issue.sceneId) continue;
      map.set(issue.sceneId, [...(map.get(issue.sceneId) ?? []), issue]);
    }
    return map;
  }, [issues]);

  // ---- Autosave ----

  /** Shows the project as the server has it: after a job, a conflict, or a takeover. */
  const showProject = useCallback((fresh: ProjectDetailDto) => {
    setSpec(fresh.draft.spec);
    setSavedSpec(fresh.draft.spec);
    setRev(fresh.draft.rev);
    setTitle(fresh.title);
    setStale(fresh.stale.storyboard);
    setUsed(fresh.counters.generationsUsed);
  }, []);

  const save = useCallback(async (): Promise<boolean> => {
    if (!spec || spec === savedSpec) return true;
    const snapshot = spec;
    setSaveState("saving");
    const request = (async () => {
      try {
        const saved = await apiFetch<DraftSavedDto>(`/projects/${projectId}/draft`, {
          method: "PUT",
          body: { baseRev: rev, spec: snapshot },
          editorId: tabId,
        });
        setRev(saved.rev);
        setSavedSpec(snapshot);
        setSaveState("saved");
        setError(null);
        return true;
      } catch (failure) {
        setSaveState("failed");
        if (failure instanceof ApiRequestError && failure.code === "LEASE_HELD") {
          leaseLost(failure.details);
          setError(leaseLostMessage);
        } else if (failure instanceof ApiRequestError && failure.code === "REV_CONFLICT") {
          setError("This video changed in another place. Showing the latest version.");
          showProject(await apiFetch<ProjectDetailDto>(`/projects/${projectId}`));
        } else {
          setError(
            failure instanceof ApiRequestError
              ? failure.message
              : "Couldn't save. Check your connection.",
          );
        }
        return false;
      } finally {
        saving.current = null;
      }
    })();
    saving.current = request;
    return request;
  }, [spec, savedSpec, rev, projectId, tabId, leaseLost, showProject]);

  useEffect(() => {
    // Not while a job runs: its storyboard is saved only over the draft it started from.
    if (!dirty || readOnly || working || saveState === "failed") return;
    const timer = setTimeout(() => void save(), autosaveMs);
    return () => clearTimeout(timer);
  }, [dirty, readOnly, working, saveState, save]);

  function changeScene(next: Scene) {
    setSaveState("idle");
    setSpec((current) =>
      current
        ? { ...current, scenes: current.scenes.map((s) => (s.id === next.id ? next : s)) }
        : current,
    );
  }

  function changeTemplate(scene: Scene, template: TemplateName) {
    changeScene(convertScene(scene, template));
  }

  async function takeOver() {
    setReloading(true);
    try {
      await lease.takeover();
      setError(null);
      setSaveState("idle");
      showProject(await apiFetch<ProjectDetailDto>(`/projects/${projectId}`));
    } finally {
      setReloading(false);
    }
  }

  // ---- Building ----

  async function build(overwrite: boolean) {
    setConfirmRebuild(false);
    setBusy("build");
    setError(null);
    // Edits waiting to be saved go first, so the job starts from the draft as it is.
    if (!(await (saving.current ?? save()))) {
      setBusy(null);
      return;
    }
    try {
      const started = await apiFetch<JobDto>(`/projects/${projectId}/storyboard`, {
        method: "POST",
        idempotent: true,
        body: overwrite ? { overwrite: true } : {},
        editorId: tabId,
      });
      setUsed((n) => n + 1);
      setJob(started);
    } catch (failure) {
      if (
        failure instanceof ApiRequestError &&
        failure.code === "STAGE_INVALID" &&
        failure.details?.needs === "overwrite"
      ) {
        setConfirmRebuild(true);
      } else if (failure instanceof ApiRequestError && failure.code === "LEASE_HELD") {
        leaseLost(failure.details);
        setError(leaseLostMessage);
      } else {
        setError(
          failure instanceof ApiRequestError ? failure.message : "Couldn't start. Try again.",
        );
      }
    } finally {
      setBusy(null);
    }
  }

  /** The job finished: show the new storyboard, or give the AI request back. */
  const onSettled = useCallback(
    async (done: JobDto) => {
      if (done.status === "succeeded") {
        showProject(await apiFetch<ProjectDetailDto>(`/projects/${projectId}`));
        setSaveState("idle");
      } else {
        setUsed((n) => Math.max(0, n - 1));
      }
      setJob(done);
    },
    [projectId, showProject],
  );

  async function generate() {
    setError(null);
    setBusy("generate");
    const ok = await (saving.current ?? save());
    if (!ok) {
      setBusy(null);
      return;
    }
    try {
      // Over the rev just saved: read back, since the save's state update is still pending.
      const fresh = await apiFetch<ProjectDetailDto>(`/projects/${projectId}`);
      await apiFetch<JobDto>(`/projects/${projectId}/generate`, {
        method: "POST",
        idempotent: true,
        body: { baseRev: fresh.draft.rev },
        editorId: tabId,
      });
      router.push(`/projects/${projectId}/generating`);
    } catch (failure) {
      if (failure instanceof ApiRequestError && failure.code === "LEASE_HELD") {
        leaseLost(failure.details);
        setError(leaseLostMessage);
      } else {
        setError(
          failure instanceof ApiRequestError ? failure.message : "Couldn't start. Try again.",
        );
      }
      setBusy(null);
    }
  }

  // ---- What the page shows ----

  const scenes = spec?.scenes ?? [];
  // The same figure the length rule uses, so the footer and the banner agree.
  const totalSeconds = spec ? Math.round(estimatedVideoMs(spec) / 1000) : 0;
  const sceneNumber = (id: string | null) => scenes.findIndex((scene) => scene.id === id) + 1;
  const firstIssue = issues[0];
  const issueScenes = [...issuesBy.keys()];
  /** Scenes needing a fix besides the one the banner names. */
  const otherScenes = issueScenes.length - (firstIssue?.sceneId ? 1 : 0);
  const blockedByLimit = usage.reached && !usage.counted;
  const canGenerate =
    spec !== null && scenes.length > 0 && issues.length === 0 && !working && !blockedByLimit;
  const unsavedHere = lease.state.status === "elsewhere" && dirty;
  const editingScene = scenes.find((scene) => scene.id === editing);

  const usageLine = blockedByLimit
    ? `You’ve used all ${usage.max} videos this month. More on ${usage.resetsOn}.`
    : usage.counted
      ? "This video already counts this month, so generating it again uses no more."
      : `Generating uses 1 of your ${usage.max} videos this month. You have ${usage.remaining} left.`;
  const usageShort = blockedByLimit
    ? `No videos left this month · more on ${usage.resetsOn}`
    : usage.counted
      ? "Already counted this month"
      : `Uses 1 of your ${usage.max} videos this month · ${usage.remaining} left`;
  const summary = `${scenes.length} scenes · about ${totalSeconds} s`;
  /** Why Generate waits: marked scenes, or an issue with the whole video (its length). */
  const blockedBy =
    issueScenes.length > 0
      ? "Fix the scenes marked above to generate the video."
      : "Fix the issue above to generate the video.";

  const generateButton = (phone: boolean) => (
    <Button
      size="lg"
      icon="sparkles"
      fullWidth={phone}
      loading={busy === "generate"}
      disabled={!canGenerate || busy !== null}
      aria-describedby={issues.length > 0 ? "sb-blocked" : undefined}
      onClick={() => void generate()}
      className={phone ? "min-h-[52px]" : undefined}
    >
      Generate video
    </Button>
  );

  return (
    <div className="-mx-4 -mt-1 flex flex-1 flex-col md:-mx-10 md:-mt-7 md:-mb-12">
      {/* Phones: a full screen with its own header (MobileStoryboard). */}
      <div className="flex flex-col gap-2 pb-2 md:hidden">
        <header className="flex h-14 items-center gap-1 pr-3 pl-1">
          <Link
            href={`/projects/${projectId}/script`}
            aria-label="Back"
            className="inline-flex size-11 items-center justify-center rounded-[12px] text-ink-secondary"
          >
            <ChevronLeft aria-hidden="true" size={22} strokeWidth={1.75} />
          </Link>
          <h1 className="m-0 flex-1 font-display text-[17px] font-extrabold">Storyboard</h1>
          <span className="text-[13px] text-ink-muted tabular-nums">Step 3 of 4</span>
        </header>
        <StepBars step={3} />
      </div>

      {/* Desktop: the header bar with the stepper and the save status. */}
      <header className="hidden flex-wrap items-center justify-between gap-4 border-b border-line bg-surface px-10 py-4 md:flex">
        <div className="flex min-w-[200px] flex-[1_1_0] flex-col gap-0.5">
          <Link
            href={`/projects/${projectId}/script`}
            className="text-[13px] font-semibold text-brand-text no-underline"
          >
            ← Script
          </Link>
          <h1
            title={title}
            className="m-0 truncate font-display text-[24px] leading-[30px] font-extrabold tracking-[-0.02em]"
          >
            {title}
          </h1>
        </div>
        <Stepper step={3} className="py-4" />
        <span
          className="w-[112px] shrink-0 text-right text-[13px] text-ink-muted"
          aria-live="polite"
        >
          {!spec
            ? ""
            : unsavedHere
              ? "Not saved"
              : dirty && saveState !== "failed"
                ? "Saving…"
                : saveLabel(saveState)}
        </span>
      </header>

      <div className="flex flex-col gap-3 px-4 pt-4 md:gap-6 md:px-10 md:pt-7">
        <div className="hidden flex-wrap items-end justify-between gap-4 md:flex">
          <div className="flex max-w-[680px] flex-col gap-1.5">
            <h2 className="m-0 font-display text-[22px] font-extrabold tracking-[-0.015em]">
              Storyboard
            </h2>
            <p className="m-0 text-[15px] leading-[23px] text-ink-muted">
              Each scene shows what the narrator says and what appears on screen. Highlighted words
              are the moments each visual appears.
            </p>
          </div>
          {spec ? (
            <Button
              variant="secondary"
              icon="sparkles"
              disabled={!canAsk}
              onClick={() => setConfirmRebuild(true)}
            >
              Rebuild storyboard
            </Button>
          ) : null}
        </div>
        <h2 className="sr-only md:hidden">Scenes</h2>

        {lease.state.status === "elsewhere" ? (
          <Notice>
            <span className="flex-1">
              {lease.state.byYou
                ? "You have this video open in another tab."
                : "Someone is editing this video in another place."}{" "}
              You can look, but changes are off here.
            </span>
            <Button variant="secondary" size="sm" onClick={() => void takeOver()}>
              Edit here instead
            </Button>
          </Notice>
        ) : null}

        {stale && spec && !working ? (
          <Notice>
            <span className="flex-1">The script changed after these scenes were made.</span>
            <span className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                icon="sparkles"
                disabled={!canAsk}
                onClick={() => setConfirmRebuild(true)}
              >
                Rebuild storyboard
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setStale(false)}>
                Dismiss
              </Button>
            </span>
          </Notice>
        ) : null}

        {firstIssue && !working ? (
          <div
            role="status"
            className="flex items-start gap-3 rounded-[12px] bg-warning-soft px-3 py-3 text-[14px] leading-5 text-warning md:rounded-[14px] md:px-4 md:py-3.5 md:leading-[21px]"
          >
            <Icon name="alert" size={18} className="mt-px shrink-0 md:size-5" />
            <span>
              <strong>
                {firstIssue.sceneId
                  ? `Scene ${sceneNumber(firstIssue.sceneId)} needs a fix.`
                  : "The video needs a fix."}
              </strong>{" "}
              <span className={cn(firstIssue.sceneId && "hidden md:inline")}>
                {issueText(
                  firstIssue,
                  scenes.find((scene) => scene.id === firstIssue.sceneId),
                )}
                {otherScenes > 0
                  ? ` ${otherScenes} ${firstIssue.sceneId ? "more " : ""}${otherScenes === 1 ? "scene needs" : "scenes need"} a fix too.`
                  : ""}
              </span>
              {firstIssue.sceneId ? (
                <span className="md:hidden">Tap it to see what’s wrong.</span>
              ) : null}
            </span>
          </div>
        ) : null}

        {job ? (
          <StoryboardJob
            key={job.id}
            job={job}
            onSettled={(done) => void onSettled(done)}
            onRetry={() => void build(spec !== null)}
            canRetry={canAsk}
          />
        ) : null}

        {error || unsavedHere ? (
          <p role="alert" className="m-0 flex items-start gap-2 text-[14px] text-danger">
            <Icon name="alert" size={18} className="mt-px shrink-0" />
            {error ?? leaseLostMessage}
          </p>
        ) : null}

        {!spec && (!job || job.status === "failed" || job.status === "cancelled") ? (
          <div className="flex max-w-[680px] flex-col items-start gap-3 rounded-[16px] border border-line bg-surface p-6 md:rounded-[20px]">
            <p className="m-0 text-[15px] leading-[23px] text-ink-secondary">
              There’s no storyboard yet. Vidcosmos splits your script into scenes and picks a visual
              for each line. You can change any scene.
            </p>
            <Button
              icon="sparkles"
              loading={busy === "build"}
              disabled={!canAsk || !project.script}
              onClick={() => void build(false)}
            >
              {busy === "build" ? "Starting…" : "Build the storyboard"}
            </Button>
            <span className="text-[13px] text-ink-muted">
              {project.script
                ? `Uses 1 of ${project.counters.generationsMax} AI requests for this video`
                : "Write the script first."}
            </span>
          </div>
        ) : null}

        {outOfRequests && spec ? (
          <p className="m-0 text-[14px] text-ink-secondary">
            This video has used all {project.counters.generationsMax} of its AI requests. You can
            still change the scenes yourself.
          </p>
        ) : null}
      </div>

      {spec ? (
        <>
          <span className="px-4 pt-3 text-[13px] text-ink-muted tabular-nums md:hidden">
            {summary} · tap a scene to edit it
          </span>
          {/* Desktop cards (Storyboard). */}
          <ol
            aria-label="Scenes"
            className={cn(
              "m-0 hidden list-none grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-4 px-10 pt-6 pb-8 md:grid",
              working && "opacity-60",
            )}
          >
            {scenes.map((scene, index) => (
              <SceneCard
                key={scene.id}
                scene={scene}
                number={index + 1}
                spec={spec}
                issues={issuesBy.get(scene.id) ?? []}
                disabled={readOnly || working}
                onEdit={() => setEditing(scene.id)}
                onTemplate={(template) => changeTemplate(scene, template)}
              />
            ))}
          </ol>
          {/* Phone rows (MobileStoryboard). */}
          <ol
            aria-label="Scenes"
            className={cn(
              "m-0 flex list-none flex-col gap-3 px-4 pt-3 pb-4 md:hidden",
              working && "opacity-60",
            )}
          >
            {scenes.map((scene, index) => (
              <SceneRow
                key={scene.id}
                scene={scene}
                number={index + 1}
                spec={spec}
                issues={issuesBy.get(scene.id) ?? []}
                disabled={readOnly || working}
                onEdit={() => setEditing(scene.id)}
                onTemplate={(template) => changeTemplate(scene, template)}
              />
            ))}
          </ol>
          <div className="px-4 pb-[150px] md:hidden">
            <Button
              variant="ghost"
              icon="sparkles"
              disabled={!canAsk}
              onClick={() => setConfirmRebuild(true)}
            >
              Rebuild storyboard
            </Button>
          </div>

          {/* Desktop: what Generate makes and uses, kept in view. */}
          <div className="sticky bottom-0 z-20 mt-auto hidden flex-wrap items-center justify-between gap-4 border-t border-line bg-surface px-10 py-4 md:flex">
            <div className="flex flex-col gap-0.5 tabular-nums">
              <span className="font-semibold">{summary}</span>
              <span id="sb-blocked" className="text-[13px] text-ink-muted">
                {issues.length > 0 ? blockedBy : usageLine}
              </span>
            </div>
            {generateButton(false)}
          </div>

          {/* Phones: the one thing to do next, kept at the bottom of the screen. */}
          <div className="fixed inset-x-0 bottom-0 z-30 flex flex-col gap-2 border-t border-line bg-surface px-4 pt-3 pb-[max(28px,env(safe-area-inset-bottom))] md:hidden">
            {generateButton(true)}
            <span className="text-center text-[12px] text-ink-muted">
              {issues.length > 0 ? blockedBy.replace(" the video.", "") : usageShort}
            </span>
          </div>
        </>
      ) : null}

      {editingScene && spec ? (
        <SceneEditor
          key={editingScene.id}
          scene={editingScene}
          number={sceneNumber(editingScene.id)}
          spec={spec}
          issues={issuesBy.get(editingScene.id) ?? []}
          readOnly={readOnly || working}
          onChange={changeScene}
          onClose={() => setEditing(null)}
        />
      ) : null}

      <RebuildDialog
        open={confirmRebuild}
        scenes={scenes.length}
        edited={scenes.some((scene) => scene.userEdited) || dirty}
        onClose={() => setConfirmRebuild(false)}
        onConfirm={() => void build(spec !== null)}
      />
    </div>
  );
}

function saveLabel(state: SaveState): string {
  switch (state) {
    case "saving":
      return "Saving…";
    case "saved":
      return "Saved just now";
    case "failed":
      return "Not saved";
    default:
      return "Saved";
  }
}

/** Progress while the storyboard is built; its error when it failed. */
function StoryboardJob({
  job: initial,
  onSettled,
  onRetry,
  canRetry,
}: {
  job: JobDto;
  onSettled: (job: JobDto) => void;
  onRetry: () => void;
  canRetry: boolean;
}) {
  const [job] = useJob(initial);
  const reported = useRef(false);

  useEffect(() => {
    if (reported.current || initial.status === job.status) return;
    if (job.status === "succeeded" || job.status === "failed" || job.status === "cancelled") {
      reported.current = true;
      onSettled(job);
    }
  }, [job, initial.status, onSettled]);

  if (job.status === "succeeded" || job.status === "cancelled") return null;
  if (job.status === "failed") {
    return (
      <div
        role="alert"
        className="flex max-w-[680px] flex-col items-start gap-3 rounded-[16px] border border-line bg-surface p-5"
      >
        <p className="m-0 flex items-start gap-2 text-[15px] text-ink">
          <Icon name="alert" size={18} className="mt-0.5 shrink-0 text-danger" />
          {job.error?.message ?? "Something went wrong. Try again."}
        </p>
        {job.error?.retryable ? (
          <Button variant="secondary" size="sm" disabled={!canRetry} onClick={onRetry}>
            Try again
          </Button>
        ) : null}
      </div>
    );
  }
  return (
    <div className="flex max-w-[680px] flex-col gap-3" aria-busy="true">
      <ProgressBar value={job.progress} label={job.message ?? "Building the storyboard"} live />
    </div>
  );
}

function RebuildDialog({
  open,
  scenes,
  edited,
  onClose,
  onConfirm,
}: {
  open: boolean;
  scenes: number;
  edited: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} labelledBy="rebuild-title">
      <div className="flex flex-col gap-5 p-6">
        <div className="flex flex-col gap-2">
          <h2 id="rebuild-title" className="h3 m-0">
            Rebuild the storyboard?
          </h2>
          <p className="m-0 text-[15px] leading-[23px] text-ink-secondary">
            New scenes are made from the script and replace these {scenes}
            {edited ? ", with the changes you made to them" : ""}. It uses 1 AI request for this
            video.
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>
            Keep these scenes
          </Button>
          <Button variant="danger" icon="sparkles" onClick={onConfirm}>
            Rebuild storyboard
          </Button>
        </div>
      </div>
    </Modal>
  );
}
