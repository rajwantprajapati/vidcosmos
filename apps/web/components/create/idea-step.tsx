"use client";

// Step 1 of making a video (NewVideo and MobileNewVideo designs, API §5-6): the topic, notes,
// video type and settings, saved as you go, and the angles. "Suggest angles" starts an `ideas`
// job (one AI request) and shows its progress; the angles replace any earlier ones. Picking
// one saves it; "Write the script" starts the script job (F15) and opens step 2, "Skip angles"
// does the same from the topic alone. A video that has a script already just opens step 2.
//
// On /projects/new there is no project yet: the first "Suggest angles" creates it, then opens
// its own step 1, which picks the running job up again.
import type { JobDto, ProjectDetailDto, ProjectSettingsDto } from "@vidcosmos/spec/api";
import type { VideoType } from "@vidcosmos/spec/collections";
import { ChevronRight, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { useJob } from "@/components/jobs/use-job";
import { LimitNotice, type VideoLimit } from "@/components/library/limit-notice";
import { Button, Chip, cn, Icon, ProgressBar, SegmentedControl, TextField } from "@/components/ui";
import { apiFetch, ApiRequestError } from "@/lib/api-client";
import { Notice } from "./notice";
import { StepBars, Stepper } from "./stepper";
import { useEditLease } from "./use-edit-lease";

type Settings = Pick<
  ProjectSettingsDto,
  "lengthSec" | "language" | "voiceGender" | "format" | "tone" | "audienceLevel"
>;
type Angle = ProjectDetailDto["idea"]["angles"][number];

const videoTypes: { value: VideoType; label: string }[] = [
  { value: "explainer", label: "Explainer" },
  { value: "product_ad", label: "Product ad" },
  { value: "story", label: "Story" },
  { value: "travel", label: "Travel" },
  { value: "quote", label: "Quote" },
  { value: "music_visual", label: "Music visual" },
];
const lengths = [
  { value: "30", label: "30 s" },
  { value: "60", label: "60 s" },
  { value: "90", label: "90 s" },
];
const languages = [
  { value: "en", label: "English" },
  { value: "hi", label: "हिंदी", lang: "hi" },
];
const narrators = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
];
const formats = [
  { value: "9:16", label: "9:16" },
  { value: "16:9", label: "16:9" },
  { value: "1:1", label: "1:1" },
];
const tones = [
  { value: "friendly", label: "Friendly" },
  { value: "professional", label: "Professional" },
  { value: "energetic", label: "Energetic" },
  { value: "calm", label: "Calm" },
];
const audiences = [
  { value: "beginner", label: "Beginners" },
  { value: "kids", label: "Kids" },
  { value: "intermediate", label: "Intermediate" },
  { value: "expert", label: "Experts" },
];
const labelOf = (list: { value: string; label: string }[], value: string) =>
  list.find((item) => item.value === value)?.label ?? value;

const autosaveMs = 800;
const topicMax = 500;

export type IdeaStepProps = {
  /** Null on /projects/new, before the project exists. */
  project: ProjectDetailDto | null;
  /** Settings for a new project: the workspace defaults. */
  defaults: Settings;
  /** The running `ideas` job, or the last one if it failed. */
  ideasJob: JobDto | null;
  /** AI requests for this video. */
  generations: { used: number; max: number };
  /** The monthly allowance is used up (only matters before the project exists). */
  limit?: VideoLimit;
};

type Draft = {
  topic: string;
  notes: string;
  videoType: VideoType;
  settings: Settings;
};

function draftOf(project: ProjectDetailDto | null, defaults: Settings): Draft {
  return {
    topic: project?.idea.topic ?? "",
    notes: project?.idea.notes ?? "",
    videoType: project?.idea.videoType ?? "explainer",
    settings: project
      ? {
          lengthSec: project.settings.lengthSec,
          language: project.settings.language,
          voiceGender: project.settings.voiceGender,
          format: project.settings.format,
          tone: project.settings.tone,
          audienceLevel: project.settings.audienceLevel,
        }
      : defaults,
  };
}

/** The PATCH body for what changed since the last save; null when nothing did. */
function changes(saved: Draft, next: Draft): Record<string, unknown> | null {
  const idea: Record<string, unknown> = {};
  if (next.topic.trim() !== saved.topic.trim() && next.topic.trim().length >= 3) {
    idea.topic = next.topic.trim();
  }
  if (next.notes.trim() !== saved.notes.trim()) idea.notes = next.notes.trim() || null;
  if (next.videoType !== saved.videoType) idea.videoType = next.videoType;
  const settings: Record<string, unknown> = {};
  for (const key of Object.keys(next.settings) as (keyof Settings)[]) {
    if (next.settings[key] !== saved.settings[key]) settings[key] = next.settings[key];
  }
  const body: Record<string, unknown> = {};
  if (Object.keys(idea).length) body.idea = idea;
  if (Object.keys(settings).length) body.settings = settings;
  return Object.keys(body).length ? body : null;
}

export function IdeaStep({ project, defaults, ideasJob, generations, limit }: IdeaStepProps) {
  const router = useRouter();
  const projectId = project?.id ?? null;
  const lease = useEditLease(projectId);
  const { editorId: tabId, lost: leaseLost } = lease;
  const [draft, setDraft] = useState<Draft>(() => draftOf(project, defaults));
  const saved = useRef<Draft>(draftOf(project, defaults));
  const [angles, setAngles] = useState<Angle[]>(project?.idea.angles ?? []);
  const [picked, setPicked] = useState<string | null>(project?.idea.selectedAngleId ?? null);
  const [used, setUsed] = useState(generations.used);
  const [busy, setBusy] = useState<"suggest" | "next" | null>(null);
  const [topicError, setTopicError] = useState<string>();
  const [notesError, setNotesError] = useState<string>();
  const [error, setError] = useState<string | null>(null);
  const [pickError, setPickError] = useState<string | null>(null);

  const hasScript = Boolean(project?.script);
  const readOnly = lease.state.status === "elsewhere";
  const outOfRequests = used >= generations.max;
  const blockedByLimit = !projectId && Boolean(limit);
  const canSuggest = !readOnly && !outOfRequests && !blockedByLimit;

  // ---- Autosave (only once the project exists) ----

  /** Saves what changed. True when everything typed is saved (or there's nothing to save). */
  const save = useCallback(async (): Promise<boolean> => {
    if (!projectId) return true;
    const body = changes(saved.current, draft);
    if (!body) return true;
    const snapshot = draft;
    try {
      await apiFetch(`/projects/${projectId}`, { method: "PATCH", body, editorId: tabId });
      saved.current = {
        ...snapshot,
        topic: snapshot.topic.trim().length >= 3 ? snapshot.topic : saved.current.topic,
      };
      setError(null);
      return true;
    } catch (failure) {
      if (failure instanceof ApiRequestError && failure.code === "LEASE_HELD") {
        // Another tab took over: this one goes read-only and says what wasn't saved.
        leaseLost(failure.details);
        setError("Another tab took over editing, so your last change wasn’t saved here.");
      } else if (failure instanceof ApiRequestError && failure.code === "CONTENT_BLOCKED") {
        if ((body.idea as { notes?: unknown } | undefined)?.notes !== undefined) {
          setNotesError(failure.message);
        } else {
          setTopicError(failure.message);
        }
      } else {
        setError(
          failure instanceof ApiRequestError
            ? failure.message
            : "Couldn't save. Check your connection.",
        );
      }
      return false;
    }
  }, [projectId, draft, tabId, leaseLost]);

  useEffect(() => {
    if (!projectId || !changes(saved.current, draft)) return;
    const timer = setTimeout(() => void save(), autosaveMs);
    return () => clearTimeout(timer);
  }, [projectId, draft, save]);

  const update = (next: Partial<Draft>) => setDraft((d) => ({ ...d, ...next }));
  const updateSettings = (next: Partial<Settings>) =>
    setDraft((d) => ({ ...d, settings: { ...d.settings, ...next } }));

  // ---- The ideas job ----

  const [currentJob, setCurrentJob] = useState<JobDto | null>(ideasJob);

  /**
   * Before starting anything: the topic is long enough and no field holds a refused edit.
   * Returns false (with focus on the field and its message showing) when it isn't so.
   */
  function readyToGo(): boolean {
    setError(null);
    setPickError(null);
    if (draft.topic.trim().length < 3) {
      setTopicError("Describe your video in a few words.");
      document.getElementById("nv-topic")?.focus();
      return false;
    }
    if (topicError || notesError) {
      document.getElementById(topicError ? "nv-topic" : "nv-notes")?.focus();
      return false;
    }
    return true;
  }

  /** /projects/new: create the project from what's typed. */
  async function createProject(): Promise<string> {
    const created = await apiFetch<{ id: string }>("/projects", {
      method: "POST",
      idempotent: true,
      body: {
        topic: draft.topic.trim(),
        ...(draft.notes.trim() ? { notes: draft.notes.trim() } : {}),
        videoType: draft.videoType,
        settings: draft.settings,
      },
    });
    return created.id;
  }

  /** A refused create or save: the message goes on its field, or under the form. */
  function showFailure(failure: unknown, fallback: string) {
    const message = failure instanceof ApiRequestError ? failure.message : fallback;
    if (failure instanceof ApiRequestError && failure.code === "CONTENT_BLOCKED") {
      setTopicError(message);
      document.getElementById("nv-topic")?.focus();
    } else {
      setError(message);
    }
  }

  async function suggest() {
    if (!readyToGo()) return;
    setBusy("suggest");
    try {
      if (!projectId) {
        // /projects/new: create the project, start its ideas, then open its own step 1.
        const id = await createProject();
        const editorId = lease.editorId;
        await apiFetch(`/projects/${id}/lease`, { method: "POST", body: {}, editorId });
        await apiFetch(`/projects/${id}/ideas`, {
          method: "POST",
          idempotent: true,
          body: {},
          editorId,
        });
        router.replace(`/projects/${id}/idea`);
        return;
      }
      // A refused or failed save stops here: the job would run on the old text.
      if (!(await save())) return;
      const job = await apiFetch<JobDto>(`/projects/${projectId}/ideas`, {
        method: "POST",
        idempotent: true,
        body: {},
        editorId: lease.editorId,
      });
      setUsed((n) => n + 1);
      setCurrentJob(job);
    } catch (failure) {
      showFailure(failure, "Couldn't start. Try again.");
    } finally {
      setBusy(null);
    }
  }

  // ---- Picking an angle, and moving on ----

  async function pick(id: string) {
    setPicked(id);
    setPickError(null);
    if (!projectId) return;
    try {
      await apiFetch(`/projects/${projectId}`, {
        method: "PATCH",
        body: { idea: { selectedAngleId: id } },
        editorId: lease.editorId,
      });
    } catch (failure) {
      if (failure instanceof ApiRequestError && failure.code === "LEASE_HELD") {
        lease.lost(failure.details);
      }
      setError(failure instanceof ApiRequestError ? failure.message : "Couldn't save your pick.");
    }
  }

  async function next(skip: boolean) {
    // Another tab is editing: step 2 opens to look at, and nothing here is saved.
    if (projectId && readOnly) {
      router.push(`/projects/${projectId}/script`);
      return;
    }
    if (!skip && angles.length > 0 && !picked) {
      setPickError("Pick an angle, or skip angles to write from the topic.");
      return;
    }
    if (!readyToGo()) return;
    setBusy("next");
    try {
      if (!projectId) {
        // /projects/new without angles: make the project, start its script, open step 2.
        const id = await createProject();
        await apiFetch(`/projects/${id}/lease`, {
          method: "POST",
          body: {},
          editorId: lease.editorId,
        });
        await startScript(id);
        router.push(`/projects/${id}/script`);
        return;
      }
      if (!(await save())) {
        setBusy(null);
        return;
      }
      if (skip && picked) {
        await apiFetch(`/projects/${projectId}`, {
          method: "PATCH",
          body: { idea: { selectedAngleId: null } },
          editorId: lease.editorId,
        });
      }
      // The first script is written now (one AI request). A script that exists already opens
      // as it is; step 2 says so if the idea changed since it was written.
      if (!hasScript) await startScript(projectId);
      router.push(`/projects/${projectId}/script`);
    } catch (failure) {
      setBusy(null);
      showFailure(failure, "Couldn't start the script. Try again.");
    }
  }

  /** Starts the script job. One already running is fine: step 2 shows it. */
  async function startScript(id: string) {
    try {
      await apiFetch(`/projects/${id}/script`, {
        method: "POST",
        idempotent: true,
        body: {},
        editorId: lease.editorId,
      });
    } catch (failure) {
      if (failure instanceof ApiRequestError && failure.code === "JOB_IN_PROGRESS") return;
      throw failure;
    }
  }

  const suggestLabel = angles.length > 0 ? "Suggest new angles" : "Suggest angles";
  const remainingText = `Uses 1 of ${generations.max} AI requests for this video`;

  return (
    <div className="-mx-4 -mt-1 flex flex-col md:-mx-10 md:-mt-7">
      {/* Phones: a full screen with its own header (MobileNewVideo). */}
      <div className="flex flex-col gap-2 pb-2 md:hidden">
        <header className="flex h-14 items-center gap-1 pr-3 pl-1">
          <Link
            href="/library"
            aria-label="Close"
            className="inline-flex size-11 items-center justify-center rounded-[12px] text-ink-secondary"
          >
            <X aria-hidden="true" size={22} strokeWidth={1.75} />
          </Link>
          <h1 className="m-0 flex-1 font-display text-[17px] font-extrabold">New video</h1>
          <span className="text-[13px] text-ink-muted tabular-nums">Step 1 of 4 · Idea</span>
        </header>
        <StepBars step={1} />
      </div>

      {/* Desktop: the header bar with the stepper and the AI-request count. */}
      <header className="hidden flex-wrap items-center justify-between gap-4 border-b border-line bg-surface px-10 py-4 md:flex">
        <div className="flex min-w-0 flex-col gap-0.5">
          <Link href="/library" className="text-[13px] font-semibold text-brand-text no-underline">
            ← Library
          </Link>
          {/* One h1 per breakpoint: the phone header's is hidden here, this one there. */}
          <h1 className="m-0 font-display text-[24px] leading-[30px] font-extrabold tracking-[-0.02em]">
            New video
          </h1>
        </div>
        <Stepper step={1} className="py-4" />
        <span className="text-[13px] text-ink-muted tabular-nums">
          AI requests for this video: {used} of {generations.max}
        </span>
      </header>

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 px-4 pt-3 pb-[150px] md:grid-cols-[repeat(auto-fit,minmax(380px,1fr))] md:gap-8 md:px-10 md:pt-8 md:pb-12">
        {readOnly ? (
          <Notice className="md:col-span-full">
            <span>
              {lease.state.status === "elsewhere" && lease.state.byYou
                ? "You have this video open in another tab."
                : "Someone is editing this video in another place."}{" "}
              You can look, but changes are off here.
            </span>
            <Button variant="secondary" size="sm" onClick={() => void lease.takeover()}>
              Edit here instead
            </Button>
          </Notice>
        ) : null}
        {blockedByLimit && limit ? (
          <LimitNotice limit={limit} className="md:col-span-full" />
        ) : null}

        <section
          aria-labelledby="idea-h"
          className="flex flex-col gap-[22px] md:rounded-[20px] md:border md:border-line md:bg-surface md:p-7"
        >
          <div className="hidden flex-col gap-1.5 md:flex">
            <h2
              id="idea-h"
              className="m-0 font-display text-[22px] font-extrabold tracking-[-0.015em]"
            >
              What is the video about?
            </h2>
            <p className="m-0 text-[15px] text-ink-muted">
              Be specific about who it’s for. Paste your own facts in Notes and we’ll stick to them.
            </p>
          </div>
          <h2 className="sr-only md:hidden">What is the video about?</h2>
          <TextField
            id="nv-topic"
            label="Topic"
            multiline
            rows={2}
            maxLength={topicMax}
            value={draft.topic}
            disabled={readOnly}
            onChange={(event) => {
              setTopicError(undefined);
              update({ topic: event.target.value });
            }}
            helper={`${draft.topic.length} of ${topicMax} characters`}
            error={topicError}
          />
          <TextField
            id="nv-notes"
            label="Notes (optional)"
            multiline
            rows={3}
            maxLength={5000}
            placeholder="Facts, figures, a product description or a link’s text. Up to 5,000 characters."
            value={draft.notes}
            disabled={readOnly}
            onChange={(event) => {
              setNotesError(undefined);
              update({ notes: event.target.value });
            }}
            error={notesError}
          />
          <div className="flex flex-col gap-2.5">
            <span className="text-[14px] font-semibold" id="nv-type-label">
              Video type
            </span>
            <div
              role="group"
              aria-labelledby="nv-type-label"
              className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:flex-wrap md:overflow-visible md:px-0"
            >
              {videoTypes.map((type) => (
                <Chip
                  key={type.value}
                  selected={draft.videoType === type.value}
                  disabled={readOnly}
                  onClick={() => update({ videoType: type.value })}
                  className="shrink-0"
                >
                  {type.label}
                </Chip>
              ))}
            </div>
          </div>

          <SettingsGrid settings={draft.settings} onChange={updateSettings} disabled={readOnly} />
          <SettingsRows settings={draft.settings} onChange={updateSettings} disabled={readOnly} />

          <Button
            variant={angles.length > 0 ? "secondary" : "primary"}
            icon="sparkles"
            loading={busy === "suggest"}
            disabled={!canSuggest || isActive(currentJob)}
            onClick={() => void suggest()}
            className={cn("self-start", angles.length === 0 && "max-md:hidden")}
          >
            {busy === "suggest" ? "Starting…" : suggestLabel}
          </Button>
          {outOfRequests ? (
            <p className="m-0 text-[14px] text-ink-secondary">
              This video has used all {generations.max} of its AI requests.
            </p>
          ) : null}
          {error ? (
            <p role="alert" className="m-0 flex items-start gap-2 text-[14px] text-danger">
              <Icon name="alert" size={18} className="mt-px shrink-0" />
              {error}
            </p>
          ) : null}
        </section>

        <AnglesPanel
          projectId={projectId}
          job={currentJob}
          angles={angles}
          picked={picked}
          readOnly={readOnly}
          busy={busy === "next"}
          pickError={pickError}
          onPick={(id) => void pick(id)}
          onNext={(skip) => void next(skip)}
          onRetry={() => void suggest()}
          onAngles={(fresh) => {
            setAngles(fresh);
            setPicked(null);
          }}
          onFailed={() => setUsed((n) => Math.max(0, n - 1))}
          onSettled={setCurrentJob}
          canSkip={!blockedByLimit}
        />
      </div>

      {/* Phones: the one thing to do next, kept at the bottom of the screen. */}
      <div className="fixed inset-x-0 bottom-0 z-30 flex flex-col gap-2 border-t border-line bg-surface px-4 pt-3 pb-[max(28px,env(safe-area-inset-bottom))] md:hidden">
        {angles.length > 0 ? (
          <Button
            size="lg"
            fullWidth
            iconEnd="arrow-right"
            loading={busy === "next"}
            onClick={() => void next(false)}
          >
            Write the script
          </Button>
        ) : (
          <>
            <Button
              size="lg"
              fullWidth
              icon="sparkles"
              loading={busy === "suggest" || isActive(currentJob)}
              disabled={!canSuggest}
              onClick={() => void suggest()}
            >
              {busy === "suggest" || isActive(currentJob) ? "Suggesting angles…" : "Suggest angles"}
            </Button>
            <span className="text-center text-[12px] text-ink-muted">{remainingText}</span>
          </>
        )}
      </div>
    </div>
  );
}

const isActive = (job: JobDto | null) =>
  Boolean(job && (job.status === "queued" || job.status === "running"));

// ---- Settings: a grid on desktop, rows that open in place on phones ----

type SettingsProps = {
  settings: Settings;
  onChange: (next: Partial<Settings>) => void;
  disabled: boolean;
};

function SettingsGrid({ settings, onChange, disabled }: SettingsProps) {
  const label = "text-[14px] font-semibold";
  return (
    <div className="hidden grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-[18px] md:grid">
      <div className="flex flex-col gap-2">
        <span className={label}>Length</span>
        <SegmentedControl
          label="Length"
          options={lengths}
          value={String(settings.lengthSec)}
          onChange={(v) => !disabled && onChange({ lengthSec: Number(v) as Settings["lengthSec"] })}
        />
      </div>
      <div className="flex flex-col gap-2">
        <span className={label}>Language</span>
        <SegmentedControl
          label="Language"
          options={languages}
          value={settings.language}
          onChange={(v) => !disabled && onChange({ language: v as Settings["language"] })}
        />
      </div>
      <div className="flex flex-col gap-2">
        <span className={label}>Narrator</span>
        <SegmentedControl
          label="Narrator"
          options={narrators}
          value={settings.voiceGender}
          onChange={(v) => !disabled && onChange({ voiceGender: v as Settings["voiceGender"] })}
        />
      </div>
      <div className="flex flex-col gap-2">
        <span className={label}>Format</span>
        <SegmentedControl
          label="Format"
          options={formats}
          value={settings.format}
          onChange={(v) => !disabled && onChange({ format: v as Settings["format"] })}
        />
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor="nv-tone" className={label}>
          Tone
        </label>
        <Select
          id="nv-tone"
          value={settings.tone}
          options={tones}
          disabled={disabled}
          onChange={(v) => onChange({ tone: v as Settings["tone"] })}
        />
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor="nv-aud" className={label}>
          Audience
        </label>
        <Select
          id="nv-aud"
          value={settings.audienceLevel}
          options={audiences}
          disabled={disabled}
          onChange={(v) => onChange({ audienceLevel: v as Settings["audienceLevel"] })}
        />
      </div>
    </div>
  );
}

function Select({
  id,
  value,
  options,
  disabled,
  onChange,
}: {
  id: string;
  value: string;
  options: { value: string; label: string }[];
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <select
      id={id}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      className="min-h-11 w-full rounded-[10px] border border-line-strong bg-surface px-3 py-2.5 text-[15px] leading-[22px] text-ink"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function SettingsRows({ settings, onChange, disabled }: SettingsProps) {
  const [open, setOpen] = useState<string | null>(null);
  const rows: { key: string; label: string; value: string; control: ReactNode }[] = [
    {
      key: "length",
      label: "Length",
      value: labelOf(lengths, String(settings.lengthSec)),
      control: (
        <SegmentedControl
          label="Length"
          options={lengths}
          value={String(settings.lengthSec)}
          onChange={(v) => onChange({ lengthSec: Number(v) as Settings["lengthSec"] })}
        />
      ),
    },
    {
      key: "language",
      label: "Language",
      value: settings.language === "hi" ? "Hindi" : "English",
      control: (
        <SegmentedControl
          label="Language"
          options={languages}
          value={settings.language}
          onChange={(v) => onChange({ language: v as Settings["language"] })}
        />
      ),
    },
    {
      key: "narrator",
      label: "Narrator",
      value: `Indian ${settings.voiceGender}`,
      control: (
        <SegmentedControl
          label="Narrator"
          options={narrators}
          value={settings.voiceGender}
          onChange={(v) => onChange({ voiceGender: v as Settings["voiceGender"] })}
        />
      ),
    },
    {
      key: "format",
      label: "Format",
      value: settings.format,
      control: (
        <SegmentedControl
          label="Format"
          options={formats}
          value={settings.format}
          onChange={(v) => onChange({ format: v as Settings["format"] })}
        />
      ),
    },
    {
      key: "tone",
      label: "Tone and audience",
      value: `${labelOf(tones, settings.tone)} · ${labelOf(audiences, settings.audienceLevel).toLowerCase()}`,
      control: (
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="nv-tone-m" className="text-[13px] font-semibold">
              Tone
            </label>
            <Select
              id="nv-tone-m"
              value={settings.tone}
              options={tones}
              onChange={(v) => onChange({ tone: v as Settings["tone"] })}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="nv-aud-m" className="text-[13px] font-semibold">
              Audience
            </label>
            <Select
              id="nv-aud-m"
              value={settings.audienceLevel}
              options={audiences}
              onChange={(v) => onChange({ audienceLevel: v as Settings["audienceLevel"] })}
            />
          </div>
        </div>
      ),
    },
  ];
  return (
    <div className="flex flex-col gap-2.5 md:hidden">
      <span className="text-[14px] font-semibold">Settings</span>
      <div className="overflow-hidden rounded-[16px] border border-line bg-surface">
        {rows.map((row) => {
          const expanded = open === row.key;
          return (
            <div key={row.key} className="border-b border-line last:border-b-0">
              <button
                type="button"
                aria-expanded={expanded}
                aria-controls={`nv-row-${row.key}`}
                disabled={disabled}
                onClick={() => setOpen(expanded ? null : row.key)}
                className="flex min-h-[52px] w-full cursor-pointer items-center gap-3 border-0 bg-transparent px-3.5 text-left text-[15px] text-ink"
              >
                <span className="flex-1 text-ink-secondary">{row.label}</span>
                <span className="font-semibold">{row.value}</span>
                <ChevronRight
                  aria-hidden="true"
                  size={18}
                  strokeWidth={1.75}
                  className={cn(
                    "text-ink-muted transition-transform motion-reduce:transition-none",
                    expanded && "rotate-90",
                  )}
                />
              </button>
              {expanded ? (
                <div id={`nv-row-${row.key}`} className="px-3.5 pb-3.5">
                  {row.control}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---- Angles ----

type AnglesPanelProps = {
  projectId: string | null;
  job: JobDto | null;
  angles: Angle[];
  picked: string | null;
  readOnly: boolean;
  busy: boolean;
  pickError: string | null;
  onPick: (id: string) => void;
  onNext: (skip: boolean) => void;
  onRetry: () => void;
  onAngles: (angles: Angle[]) => void;
  onFailed: () => void;
  /** The job finished: Suggest works again. */
  onSettled: (job: JobDto) => void;
  /** False on /projects/new at the monthly limit: no new video at all. */
  canSkip: boolean;
};

function AnglesPanel(props: AnglesPanelProps) {
  const { angles, picked, readOnly } = props;
  return (
    <section aria-labelledby="angles-h" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2
          id="angles-h"
          className="m-0 font-display text-[20px] font-extrabold tracking-[-0.015em] md:text-[22px]"
        >
          Pick an angle
        </h2>
        <span className="text-[13px] text-ink-muted">
          {angles.length > 0
            ? `${angles.length} suggestions · or write from the topic`
            : "Suggestions appear here"}
        </span>
      </div>

      {props.job ? <IdeasJob key={props.job.id} {...props} job={props.job} /> : null}

      {angles.length > 0 ? (
        <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
          <legend className="sr-only">Angles</legend>
          {angles.map((angle) => {
            const on = picked === angle.id;
            return (
              <label
                key={angle.id}
                className={cn(
                  "flex cursor-pointer flex-col gap-2.5 rounded-[16px] px-5 py-[18px] text-ink transition-colors motion-reduce:transition-none",
                  "has-[:focus-visible]:shadow-[0_0_0_2px_var(--bg),0_0_0_4px_var(--focus-ring)]",
                  on
                    ? "border-2 border-brand-text bg-brand-soft"
                    : "border border-line bg-surface hover:border-line-strong",
                )}
              >
                <span className="flex w-full items-center justify-between gap-3">
                  <span className="font-display text-[17px] font-bold">{angle.title}</span>
                  <input
                    type="radio"
                    name="angle"
                    value={angle.id}
                    checked={on}
                    disabled={readOnly}
                    onChange={() => props.onPick(angle.id)}
                    className="sr-only"
                  />
                  <span
                    aria-hidden="true"
                    className={cn(
                      "box-border size-5 flex-none rounded-full",
                      on ? "border-[6px] border-brand-text" : "border-2 border-line-strong",
                    )}
                  />
                </span>
                <span className="text-[15px] leading-[23px] text-ink-secondary">
                  “{angle.hook}”
                </span>
                <span className="text-[13px] leading-5 text-ink-muted">
                  {angle.outline.join(" · ")}
                </span>
              </label>
            );
          })}
        </fieldset>
      ) : !props.job || props.job.status === "failed" || props.job.status === "cancelled" ? (
        <p className="m-0 text-[15px] text-ink-secondary">
          Suggest angles to see a few ways to tell this video, or write the script straight from
          your topic.
        </p>
      ) : null}

      {props.pickError ? (
        <p role="alert" className="m-0 text-[14px] text-danger">
          {props.pickError}
        </p>
      ) : null}

      <div className="hidden flex-wrap items-center gap-4 pt-2 md:flex">
        {angles.length > 0 ? (
          <Button
            size="lg"
            iconEnd="arrow-right"
            loading={props.busy}
            onClick={() => props.onNext(false)}
          >
            Write the script
          </Button>
        ) : null}
        <button
          type="button"
          disabled={props.busy || !props.canSkip}
          onClick={() => props.onNext(true)}
          className="cursor-pointer border-0 bg-transparent p-0 text-[14px] font-semibold text-brand-text underline disabled:cursor-not-allowed disabled:opacity-45"
        >
          {angles.length > 0 ? "Skip angles" : "Write the script from the topic"}
        </button>
      </div>
      {angles.length === 0 ? (
        <Button
          variant="ghost"
          iconEnd="arrow-right"
          disabled={props.busy || !props.canSkip}
          onClick={() => props.onNext(true)}
          className="self-start md:hidden"
        >
          Write from the topic
        </Button>
      ) : null}
    </section>
  );
}

/** The running (or failed) ideas job: progress while it runs, the angles once it's done. */
function IdeasJob({
  job: initial,
  projectId,
  onAngles,
  onFailed,
  onRetry,
  onSettled,
}: AnglesPanelProps & { job: JobDto }) {
  const [job] = useJob(initial);
  const reported = useRef(false);

  useEffect(() => {
    if (reported.current || !projectId) return;
    if (job.status === "succeeded") {
      reported.current = true;
      void apiFetch<ProjectDetailDto>(`/projects/${projectId}`).then((project) => {
        onAngles(project.idea.angles);
        onSettled(job);
      });
    } else if (
      (job.status === "failed" || job.status === "cancelled") &&
      initial.status !== job.status
    ) {
      reported.current = true;
      onFailed(); // the job gave its AI request back
      onSettled(job);
    }
  }, [job, initial.status, projectId, onAngles, onFailed, onSettled]);

  if (job.status === "succeeded") return null;
  if (job.status === "failed" || job.status === "cancelled") {
    if (job.status === "cancelled") return null;
    return (
      <div
        role="alert"
        className="flex flex-col items-start gap-3 rounded-[16px] border border-line bg-surface p-5"
      >
        <p className="m-0 flex items-start gap-2 text-[15px] text-ink">
          <Icon name="alert" size={18} className="mt-0.5 shrink-0 text-danger" />
          {job.error?.message ?? "Something went wrong. Try again."}
        </p>
        {job.error?.retryable ? (
          <Button variant="secondary" size="sm" onClick={onRetry}>
            Try again
          </Button>
        ) : null}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3" aria-busy="true">
      <ProgressBar value={job.progress} label={job.message ?? "Waiting to start"} live />
      {Array.from({ length: 4 }, (_, i) => (
        <div
          key={i}
          aria-hidden="true"
          className="h-[132px] animate-pulse rounded-[16px] border border-line bg-surface motion-reduce:animate-none"
        />
      ))}
    </div>
  );
}
