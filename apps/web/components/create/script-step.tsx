"use client";

// Step 2 of making a video (Script and MobileScript designs, PRD M2, API §6): the narration
// script, saved as you type, with a live word count, estimated length and whether it fits the
// chosen length. Rewrite chips change all of it, or only the selected part (one AI request
// each); "Undo last rewrite" puts the script back. Writing a new script over one the person
// edited asks first. When the topic, notes or angle changed after the script was written, a
// banner offers a new one. "Build the storyboard" goes on to step 3.
//
// Step 1's "Write the script" starts the first script and opens this step, which picks the
// running job up. Opened without a script and without a job, it offers "Write the script".
import {
  type JobDto,
  type ProjectDetailDto,
  type RewriteInstruction,
  scriptFit,
  scriptMaxChars,
  scriptStats,
} from "@vidcosmos/spec/api";
import { videoTypeLabels } from "@vidcosmos/spec/collections";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useJob } from "@/components/jobs/use-job";
import { Badge, Button, Chip, cn, Icon, ProgressBar } from "@/components/ui";
import { apiFetch, ApiRequestError } from "@/lib/api-client";
import { Notice } from "./notice";
import { CustomRewriteDialog, OverwriteDialog } from "./script-dialogs";
import { StepBars, Stepper } from "./stepper";
import { useEditLease } from "./use-edit-lease";

const autosaveMs = 800;
const lengths = [30, 60, 90] as const;

const rewrites: {
  instruction: Exclude<RewriteInstruction, "custom" | "more_formal">;
  label: string;
}[] = [
  { instruction: "shorter", label: "Shorter" },
  { instruction: "longer", label: "Longer" },
  { instruction: "simpler", label: "Simpler" },
  { instruction: "more_engaging", label: "More engaging" },
];

const audienceText = {
  kids: "for kids",
  beginner: "for beginners",
  intermediate: "for intermediate learners",
  expert: "for experts",
} as const;
const toneText = {
  friendly: "Friendly",
  professional: "Professional",
  energetic: "Energetic",
  calm: "Calm",
} as const;

export type ScriptStepProps = {
  project: ProjectDetailDto;
  /** The running script or rewrite job, or the last one if it failed. */
  job: JobDto | null;
  /** The script before the last rewrite, while it can still be put back. */
  undo: { text: string } | null;
};

type SaveState = "idle" | "saving" | "saved" | "failed";
type Selection = { start: number; end: number } | null;

const leaseLostMessage = "Another tab took over editing, so your last change wasn’t saved here.";

const isActive = (job: JobDto | null) =>
  Boolean(job && (job.status === "queued" || job.status === "running"));

export function ScriptStep({ project, job: initialJob, undo: initialUndo }: ScriptStepProps) {
  const router = useRouter();
  const projectId = project.id;
  const lease = useEditLease(projectId);
  const { editorId: tabId, lost: leaseLost } = lease;
  const language = project.settings.language;

  const [title, setTitle] = useState(project.title);
  const [hasScript, setHasScript] = useState(project.script !== null);
  const [text, setText] = useState(project.script?.text ?? "");
  const [savedText, setSavedText] = useState(project.script?.text ?? "");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [lengthSec, setLengthSec] = useState(project.settings.lengthSec);
  const [stale, setStale] = useState(project.stale.script);
  const [undo, setUndo] = useState(initialUndo);
  const [used, setUsed] = useState(project.counters.generationsUsed);
  const [job, setJob] = useState<JobDto | null>(initialJob);
  const [busy, setBusy] = useState<"write" | "rewrite" | "next" | "undo" | null>(null);
  const [textError, setTextError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<"custom" | "overwrite" | null>(null);
  const [customSelection, setCustomSelection] = useState<Selection>(null);
  const [reloading, setReloading] = useState(false);
  /** The text a rewrite started from: what "Undo last rewrite" puts back when it's done. */
  const beforeRewrite = useRef<string | null>(null);
  const editor = useRef<HTMLTextAreaElement>(null);

  const readOnly = lease.state.status === "elsewhere" || reloading;
  const working = isActive(job);
  const outOfRequests = used >= project.counters.generationsMax;
  const canAsk = !readOnly && !working && !outOfRequests && busy === null;
  const stats = scriptStats(text, language);
  const fit = scriptFit(stats.estDurationSec, lengthSec);
  const narrator = `Indian ${project.settings.voiceGender} voice`;

  // ---- Autosave ----

  /** Saves the text. True when it's saved (or there was nothing to save). */
  const save = useCallback(async (): Promise<boolean> => {
    if (!hasScript || text === savedText) return true;
    const snapshot = text;
    setSaveState("saving");
    try {
      await apiFetch(`/projects/${projectId}`, {
        method: "PATCH",
        body: { script: { text: snapshot } },
        editorId: tabId,
      });
      setSavedText(snapshot);
      setUndo(null);
      setSaveState("saved");
      setTextError(null);
      return true;
    } catch (failure) {
      setSaveState("failed");
      if (failure instanceof ApiRequestError && failure.code === "LEASE_HELD") {
        // Another tab took over: this one goes read-only and says what wasn't saved.
        leaseLost(failure.details);
        setError(leaseLostMessage);
      } else {
        setTextError(
          failure instanceof ApiRequestError
            ? failure.message
            : "Couldn't save. Check your connection.",
        );
      }
      return false;
    }
  }, [hasScript, projectId, text, savedText, tabId, leaseLost]);

  useEffect(() => {
    if (!hasScript || readOnly || text === savedText) return;
    const timer = setTimeout(() => void save(), autosaveMs);
    return () => clearTimeout(timer);
  }, [hasScript, readOnly, text, savedText, save]);

  /** Everything typed is saved and allowed; otherwise focus goes to the script. */
  async function readyToGo(): Promise<boolean> {
    setError(null);
    if (!(await save()) || textError) {
      editor.current?.focus();
      return false;
    }
    return true;
  }

  function showFailure(failure: unknown, fallback: string) {
    if (failure instanceof ApiRequestError && failure.code === "LEASE_HELD") {
      lease.lost(failure.details);
      setError(leaseLostMessage);
      return;
    }
    setError(failure instanceof ApiRequestError ? failure.message : fallback);
  }

  /** Shows the project as the server has it: after a job, or after taking editing over. */
  const showProject = useCallback((fresh: ProjectDetailDto) => {
    const script = fresh.script;
    setText(script?.text ?? "");
    setSavedText(script?.text ?? "");
    setHasScript(script !== null);
    setTitle(fresh.title);
    setStale(fresh.stale.script);
    setLengthSec(fresh.settings.lengthSec);
    setTextError(null);
  }, []);

  async function takeOver() {
    // The other tab may have changed the script: the box stays read-only until this tab shows
    // what's saved, so nothing typed meanwhile is replaced.
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

  // ---- Writing and rewriting ----

  async function write(overwrite = false) {
    setDialog(null);
    if (hasScript && !(await readyToGo())) return;
    setBusy("write");
    setError(null);
    try {
      const started = await apiFetch<JobDto>(`/projects/${projectId}/script`, {
        method: "POST",
        idempotent: true,
        body: overwrite ? { overwrite: true } : {},
        editorId: lease.editorId,
      });
      beforeRewrite.current = null;
      setUsed((n) => n + 1);
      setJob(started);
    } catch (failure) {
      if (
        failure instanceof ApiRequestError &&
        failure.code === "STAGE_INVALID" &&
        failure.details?.needs === "overwrite"
      ) {
        setDialog("overwrite");
      } else {
        showFailure(failure, "Couldn't start. Try again.");
      }
    } finally {
      setBusy(null);
    }
  }

  /** The selected part of the script, if any words are selected. */
  function currentSelection(): Selection {
    const element = editor.current;
    if (!element) return null;
    const { selectionStart: start, selectionEnd: end } = element;
    return end > start && text.slice(start, end).trim() ? { start, end } : null;
  }

  async function rewrite(instruction: RewriteInstruction, custom?: string, part?: Selection) {
    const selection = part === undefined ? currentSelection() : part;
    setDialog(null);
    if (!(await readyToGo())) return;
    setBusy("rewrite");
    try {
      const started = await apiFetch<JobDto>(`/projects/${projectId}/script/rewrite`, {
        method: "POST",
        idempotent: true,
        body: {
          instruction,
          ...(custom ? { custom } : {}),
          ...(selection ? { selection } : {}),
        },
        editorId: lease.editorId,
      });
      beforeRewrite.current = text;
      setUsed((n) => n + 1);
      setJob(started);
    } catch (failure) {
      showFailure(failure, "Couldn't start the rewrite. Try again.");
    } finally {
      setBusy(null);
    }
  }

  function openCustom() {
    setCustomSelection(currentSelection());
    setDialog("custom");
  }

  /** The job finished: load the new script, or give the AI request back. */
  const onSettled = useCallback(
    async (done: JobDto) => {
      if (done.status === "succeeded") {
        showProject(await apiFetch<ProjectDetailDto>(`/projects/${projectId}`));
        setUndo(
          done.type === "script_rewrite" && beforeRewrite.current !== null
            ? { text: beforeRewrite.current }
            : null,
        );
      } else {
        setUsed((n) => Math.max(0, n - 1));
      }
      beforeRewrite.current = null;
      setJob(done);
    },
    [projectId, showProject],
  );

  async function undoRewrite() {
    if (!undo) return;
    setBusy("undo");
    try {
      await apiFetch(`/projects/${projectId}`, {
        method: "PATCH",
        body: { script: { text: undo.text } },
        editorId: lease.editorId,
      });
      setText(undo.text);
      setSavedText(undo.text);
      setUndo(null);
      setSaveState("saved");
    } catch (failure) {
      showFailure(failure, "Couldn't undo the rewrite. Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function switchLength(next: (typeof lengths)[number]) {
    try {
      await apiFetch(`/projects/${projectId}`, {
        method: "PATCH",
        body: { settings: { lengthSec: next } },
        editorId: lease.editorId,
      });
      setLengthSec(next);
      // The button goes away with the warning: keep focus in the script.
      editor.current?.focus();
    } catch (failure) {
      showFailure(failure, "Couldn't change the length. Try again.");
    }
  }

  async function next() {
    if (readOnly) {
      router.push(`/projects/${projectId}/storyboard`);
      return;
    }
    if (!(await readyToGo())) return;
    setBusy("next");
    router.push(`/projects/${projectId}/storyboard`);
  }

  // A longer length the script would fit, for "Use 90 s".
  const longerFit = lengths.find(
    (length) => length > lengthSec && scriptFit(stats.estDurationSec, length) !== "over",
  );
  const canBuild = hasScript && stats.wordCount > 0 && !working;
  // Editing moved to another tab (found by a refused save or by the lease renewal) while this
  // one had changes waiting: they won't be saved here, and the page says so.
  const unsavedHere = lease.state.status === "elsewhere" && hasScript && text !== savedText;
  // A rewrite needs words to work on.
  const canRewrite = canAsk && hasScript && stats.wordCount > 0;

  const fitBadge = (short: boolean) =>
    fit === "fits" ? (
      <Badge tone="success" icon="check">
        {short ? `Fits ${lengthSec} s` : `Fits your ${lengthSec} s target`}
      </Badge>
    ) : fit === "over" ? (
      <Badge tone="warning" icon="alert">
        {short ? `Over ${lengthSec} s` : `Longer than your ${lengthSec} s target`}
      </Badge>
    ) : (
      <Badge tone="info" icon="clock">
        {short ? `Under ${lengthSec} s` : `Shorter than your ${lengthSec} s target`}
      </Badge>
    );

  return (
    <div className="-mx-4 -mt-1 flex flex-col md:-mx-10 md:-mt-7">
      {/* Phones: a full screen with its own header (MobileScript). */}
      <div className="flex flex-col gap-2 pb-2 md:hidden">
        <header className="flex h-14 items-center gap-1 pr-3 pl-1">
          <Link
            href={`/projects/${projectId}/idea`}
            aria-label="Back"
            className="inline-flex size-11 items-center justify-center rounded-[12px] text-ink-secondary"
          >
            <ChevronLeft aria-hidden="true" size={22} strokeWidth={1.75} />
          </Link>
          <h1 className="m-0 flex-1 font-display text-[17px] font-extrabold">Script</h1>
          <span className="text-[13px] text-ink-muted tabular-nums">Step 2 of 4</span>
        </header>
        <StepBars step={2} />
      </div>

      {/* Desktop: the header bar with the stepper and the save status. */}
      <header className="hidden flex-wrap items-center justify-between gap-4 border-b border-line bg-surface px-10 py-4 md:flex">
        <div className="flex min-w-[200px] flex-[1_1_0] flex-col gap-0.5">
          <Link
            href={`/projects/${projectId}/idea`}
            className="text-[13px] font-semibold text-brand-text no-underline"
          >
            ← Idea
          </Link>
          <h1
            title={title}
            className="m-0 truncate font-display text-[24px] leading-[30px] font-extrabold tracking-[-0.02em]"
          >
            {title}
          </h1>
        </div>
        <Stepper step={2} className="py-4" />
        {/* A fixed width, so the header doesn't reflow as the status changes. */}
        <span
          className="w-[112px] shrink-0 text-right text-[13px] text-ink-muted"
          aria-live="polite"
        >
          {!hasScript
            ? ""
            : unsavedHere
              ? "Not saved"
              : text !== savedText && saveState !== "failed"
                ? "Saving…"
                : saveLabel(saveState)}
        </span>
      </header>

      <div className="flex flex-wrap items-start gap-8 px-4 pt-4 pb-[150px] max-md:gap-3.5 md:px-10 md:pt-8 md:pb-12">
        <section
          aria-labelledby="script-h"
          className="flex min-w-0 flex-[999_1_520px] flex-col gap-4 max-md:gap-3.5"
        >
          {lease.state.status === "elsewhere" ? (
            <Notice>
              <span>
                {lease.state.status === "elsewhere" && lease.state.byYou
                  ? "You have this video open in another tab."
                  : "Someone is editing this video in another place."}{" "}
                You can look, but changes are off here.
              </span>
              <Button variant="secondary" size="sm" onClick={() => void takeOver()}>
                Edit here instead
              </Button>
            </Notice>
          ) : null}
          {stale && hasScript && !working ? (
            <Notice>
              <span className="flex-1">
                The topic, notes or angle changed after this script was written.
              </span>
              <span className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  icon="sparkles"
                  disabled={!canAsk}
                  onClick={() => void write()}
                >
                  Write a new script
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setStale(false);
                    editor.current?.focus();
                  }}
                >
                  Dismiss
                </Button>
              </span>
            </Notice>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2
              id="script-h"
              className="m-0 hidden font-display text-[22px] font-extrabold tracking-[-0.015em] md:block"
            >
              Script
            </h2>
            <h2 className="sr-only md:hidden">Script</h2>
            <div
              role="toolbar"
              aria-label="Rewrite the script"
              className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:flex-wrap md:gap-1.5 md:overflow-visible md:px-0"
            >
              {rewrites.map(({ instruction, label }) => (
                <Chip
                  key={instruction}
                  aria-pressed={undefined}
                  icon={instruction === "shorter" ? "sparkles" : undefined}
                  disabled={!canRewrite}
                  onClick={() => void rewrite(instruction)}
                  className="shrink-0 disabled:cursor-not-allowed disabled:opacity-45 max-md:min-h-11"
                >
                  {label}
                </Chip>
              ))}
              <Chip
                aria-pressed={undefined}
                aria-haspopup="dialog"
                disabled={!canRewrite}
                onClick={openCustom}
                className="shrink-0 disabled:cursor-not-allowed disabled:opacity-45 max-md:min-h-11"
              >
                Custom…
              </Chip>
            </div>
          </div>

          {job ? (
            <ScriptJob
              key={job.id}
              job={job}
              onSettled={(done) => void onSettled(done)}
              onRetry={() => void write()}
            />
          ) : null}

          {hasScript ? (
            <div
              className={cn(
                "flex max-w-[826px] flex-col gap-5 rounded-[16px] border border-line bg-surface p-[18px] focus-within:border-brand-text md:rounded-[20px] md:px-8 md:py-7",
                working && "opacity-60",
              )}
            >
              <label htmlFor="sc-text" className="sr-only">
                Script text
              </label>
              <textarea
                id="sc-text"
                ref={editor}
                lang={language}
                value={text}
                maxLength={scriptMaxChars}
                readOnly={readOnly || working}
                aria-invalid={textError ? true : undefined}
                aria-describedby="sc-stats"
                onChange={(event) => {
                  setTextError(null);
                  setSaveState("idle");
                  setText(event.target.value);
                }}
                className={cn(
                  "box-border h-[440px] w-full resize-none border-0 bg-transparent p-0 text-[17px] leading-[29px] text-ink outline-none md:h-auto md:min-h-[420px] md:resize-y md:text-[18px] md:leading-8",
                  language === "hi" && "font-deva",
                )}
              />
              <div
                id="sc-stats"
                className="hidden flex-wrap items-center justify-between gap-3 border-t border-line pt-4 text-[14px] text-ink-muted tabular-nums md:flex"
              >
                <span>
                  {stats.wordCount} words · about {Math.round(stats.estDurationSec)} s with an{" "}
                  {narrator}
                </span>
                {fitBadge(false)}
              </div>
            </div>
          ) : !job || job.status === "failed" || job.status === "cancelled" ? (
            <div className="flex max-w-[826px] flex-col items-start gap-3 rounded-[16px] border border-line bg-surface p-6 md:rounded-[20px]">
              <p className="m-0 text-[15px] leading-[23px] text-ink-secondary">
                There’s no script yet. Vidcosmos writes one sized to your {lengthSec} s video
                {project.idea.selectedAngleId ? ", from the angle you picked" : ", from your topic"}
                .
              </p>
              <Button
                icon="sparkles"
                loading={busy === "write"}
                disabled={!canAsk}
                onClick={() => void write()}
              >
                {busy === "write" ? "Starting…" : "Write the script"}
              </Button>
              <span className="text-[13px] text-ink-muted">
                Uses 1 of {project.counters.generationsMax} AI requests for this video
              </span>
            </div>
          ) : null}

          {hasScript ? (
            <div className="flex items-center justify-between gap-2 text-[13px] text-ink-muted tabular-nums md:hidden">
              <span>
                {stats.wordCount} words · about {Math.round(stats.estDurationSec)} s
              </span>
              {fitBadge(true)}
            </div>
          ) : null}

          {hasScript && fit === "over" && !working ? (
            <div className="flex max-w-[826px] flex-wrap items-center gap-3 text-[14px] text-ink-secondary">
              <span>
                About {Math.round(stats.estDurationSec)} s of narration: more than{" "}
                {Math.round(lengthSec * 1.15)} s won’t fit well.
              </span>
              <Button
                variant="secondary"
                size="sm"
                icon="sparkles"
                disabled={!canAsk}
                onClick={() => void rewrite("shorter", undefined, null)}
              >
                Trim to fit
              </Button>
              {longerFit ? (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={readOnly || working}
                  onClick={() => void switchLength(longerFit)}
                >
                  Use {longerFit} s
                </Button>
              ) : null}
            </div>
          ) : null}

          {textError ? (
            <p role="alert" className="m-0 flex items-start gap-2 text-[14px] text-danger">
              <Icon name="alert" size={18} className="mt-px shrink-0" />
              {textError}
            </p>
          ) : null}
          {error || unsavedHere ? (
            <p role="alert" className="m-0 flex items-start gap-2 text-[14px] text-danger">
              <Icon name="alert" size={18} className="mt-px shrink-0" />
              {error ?? leaseLostMessage}
            </p>
          ) : null}
          {outOfRequests ? (
            <p className="m-0 text-[14px] text-ink-secondary">
              This video has used all {project.counters.generationsMax} of its AI requests. You can
              still edit the script yourself.
            </p>
          ) : null}

          {hasScript ? (
            <p className="m-0 hidden max-w-[826px] text-[14px] text-ink-muted md:block">
              Tip: select a sentence first, then pick a rewrite to change only that part.
              {undo && !working ? (
                <>
                  {" "}
                  <button
                    type="button"
                    disabled={readOnly || busy !== null}
                    onClick={() => void undoRewrite()}
                    className="cursor-pointer border-0 bg-transparent p-0 text-[14px] text-brand-text underline disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    Undo last rewrite
                  </button>
                </>
              ) : null}
            </p>
          ) : null}
          {undo && !working && hasScript ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={readOnly || busy !== null}
              onClick={() => void undoRewrite()}
              className="self-start md:hidden"
            >
              Undo last rewrite
            </Button>
          ) : null}
        </section>

        <aside
          aria-label="Video details"
          className="hidden max-w-[420px] min-w-0 flex-[1_1_300px] flex-col gap-4 md:flex"
        >
          <SettingsCard project={project} lengthSec={lengthSec} narrator={narrator} />
          <AngleCard project={project} />
          <div className="flex flex-col gap-2.5 rounded-[20px] border border-brand-soft-line bg-brand-soft p-[22px]">
            <span className="font-display text-[17px] font-bold">Happy with the script?</span>
            <span className="text-[14px] leading-[21px] text-ink-secondary">
              Next, Vidcosmos splits it into scenes and picks a visual for each line. You can change
              any scene.
            </span>
            <Button
              size="lg"
              fullWidth
              iconEnd="arrow-right"
              loading={busy === "next"}
              disabled={!canBuild}
              onClick={() => void next()}
              className="mt-1"
            >
              Build the storyboard
            </Button>
          </div>
        </aside>
      </div>

      {/* Phones: the one thing to do next, kept at the bottom of the screen. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface px-4 pt-3 pb-[max(28px,env(safe-area-inset-bottom))] md:hidden">
        <Button
          size="lg"
          fullWidth
          iconEnd="arrow-right"
          loading={busy === "next"}
          disabled={!canBuild}
          onClick={() => void next()}
          className="min-h-[52px]"
        >
          Build the storyboard
        </Button>
      </div>

      <CustomRewriteDialog
        open={dialog === "custom"}
        selected={customSelection !== null}
        onClose={() => setDialog(null)}
        onRewrite={(custom) => void rewrite("custom", custom, customSelection)}
      />
      <OverwriteDialog
        open={dialog === "overwrite"}
        onClose={() => setDialog(null)}
        onConfirm={() => void write(true)}
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

/** Progress while a script job runs; its error when it failed. */
function ScriptJob({
  job: initial,
  onSettled,
  onRetry,
}: {
  job: JobDto;
  onSettled: (job: JobDto) => void;
  onRetry: () => void;
}) {
  const [job] = useJob(initial);
  const reported = useRef(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (reported.current || initial.status === job.status) return;
    if (job.status === "succeeded" || job.status === "failed" || job.status === "cancelled") {
      reported.current = true;
      onSettled(job);
    }
  }, [job, initial.status, onSettled]);

  if (job.status === "succeeded" || job.status === "cancelled" || dismissed) return null;
  if (job.status === "failed") {
    return (
      <div
        role="alert"
        className="flex max-w-[826px] flex-col items-start gap-3 rounded-[16px] border border-line bg-surface p-5"
      >
        <p className="m-0 flex items-start gap-2 text-[15px] text-ink">
          <Icon name="alert" size={18} className="mt-0.5 shrink-0 text-danger" />
          {job.error?.message ?? "Something went wrong. Try again."}
        </p>
        <div className="flex flex-wrap gap-2">
          {job.error?.retryable && job.type === "script" ? (
            <Button variant="secondary" size="sm" onClick={onRetry}>
              Try again
            </Button>
          ) : null}
          {job.type === "script_rewrite" ? (
            <Button variant="ghost" size="sm" onClick={() => setDismissed(true)}>
              Dismiss
            </Button>
          ) : null}
        </div>
      </div>
    );
  }
  return (
    <div className="flex max-w-[826px] flex-col gap-3" aria-busy="true">
      <ProgressBar
        value={job.progress}
        label={job.message ?? (job.type === "script" ? "Writing the script" : "Rewriting")}
        live
      />
    </div>
  );
}

function SettingsCard({
  project,
  lengthSec,
  narrator,
}: {
  project: ProjectDetailDto;
  lengthSec: number;
  narrator: string;
}) {
  const { settings, idea } = project;
  const rows: [string, string][] = [
    ["Type", videoTypeLabels[idea.videoType]],
    ["Language", settings.language === "hi" ? "Hindi" : "English"],
    ["Narrator", narrator.charAt(0).toUpperCase() + narrator.slice(1)],
    ["Length", `${lengthSec} s · ${settings.format}`],
    ["Tone", `${toneText[settings.tone]}, ${audienceText[settings.audienceLevel]}`],
  ];
  return (
    <div className="flex flex-col gap-3.5 rounded-[20px] border border-line bg-surface p-[22px]">
      <div className="flex items-center justify-between">
        <h2 className="m-0 font-display text-[17px] font-bold">Video settings</h2>
        <Link
          href={`/projects/${project.id}/idea`}
          className="text-[14px] font-semibold text-brand-text"
        >
          Edit<span className="sr-only"> video settings</span>
        </Link>
      </div>
      <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 text-[14px]">
        {rows.map(([term, value]) => (
          <div key={term} className="contents">
            <dt className="text-ink-muted">{term}</dt>
            <dd className="m-0">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function AngleCard({ project }: { project: ProjectDetailDto }) {
  const angle = project.idea.angles.find((a) => a.id === project.idea.selectedAngleId);
  return (
    <div className="flex flex-col gap-2 rounded-[20px] border border-line bg-surface p-[22px]">
      <span className="text-[12px] font-semibold tracking-[.08em] text-ink-muted uppercase">
        Angle
      </span>
      <span className="font-display text-[17px] font-bold">
        {angle ? angle.title : "From your topic"}
      </span>
      <span className="text-[14px] leading-[21px] text-ink-secondary">
        {angle ? angle.outline.join(" · ") : project.idea.topic}
      </span>
    </div>
  );
}
