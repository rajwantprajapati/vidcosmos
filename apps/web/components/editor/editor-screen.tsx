"use client";

// The editor (F21, Editor and MobileEditor designs; SDD §4 "Project editor", §9 "Preview"): the
// video plays in the Remotion Player exactly as it will export, from the draft and the
// narration's signed links. Desktop: the scene list on the left, and the dark stage with the
// player, its controls (play, time, a seek bar with scene marks, "Scene N of M") and the quick
// settings. Phones: the dark full-screen editor with the player, play and progress, a strip of
// scene thumbnails, and Scenes and Style sheets.
//
// Theme, captions and format save at once (PATCH, with this tab's edit lease) and re-lay out the
// player with no new narration. A new narrator clears every recording, so the editor offers
// "Record narration" (API §7), which opens the Generating screen. Scenes without narration play
// silently for their estimated length, marked "No narration".
//
// The Revise chat (F25), Versions (F24) and scene editing (F23) join this screen later.
import type { PlayerRef } from "@remotion/player";
import type { JobDto, ProjectDetailDto } from "@vidcosmos/spec/api";
import { sceneHeadline, templateLabels, type VideoSpec } from "@vidcosmos/spec/video";
import { ChevronLeft, Palette, Rows3 } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Modal } from "@/components/create/modal";
import { Notice } from "@/components/create/notice";
import { useEditLease } from "@/components/create/use-edit-lease";
import { Button, buttonClassName, cn, Icon, Logo, SceneRow } from "@/components/ui";
import { apiFetch, ApiRequestError } from "@/lib/api-client";
import { QuickSettings, type QuickSettingsValue } from "./quick-settings";
import { clock, framesToMs, sceneIndexAt, seconds, timelineOf } from "./timeline";

const VideoPlayer = dynamic(() => import("./video-player").then((m) => m.VideoPlayer), {
  ssr: false,
  loading: () => <div className="size-full animate-pulse rounded-[inherit] bg-surface-raised" />,
});
const SceneThumbnail = dynamic(() => import("./video-player").then((m) => m.SceneThumbnail), {
  ssr: false,
});

/** The player's width for each format: the design's 304 px for 9:16, wider for the others. */
const stageWidth: Record<VideoSpec["format"], string> = {
  "9:16": "w-[304px]",
  "1:1": "w-[420px]",
  "16:9": "w-[560px]",
};
const phoneWidth: Record<VideoSpec["format"], string> = {
  "9:16": "w-[262px]",
  "1:1": "w-[320px]",
  "16:9": "w-full",
};
const aspect: Record<VideoSpec["format"], string> = {
  "9:16": "aspect-[9/16]",
  "1:1": "aspect-square",
  "16:9": "aspect-video",
};

/** Desktop or phone, once known in the browser: one layout, so there's only one Player. */
function useDesktop(): boolean | null {
  const [desktop, setDesktop] = useState<boolean | null>(null);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 768px)");
    const update = () => setDesktop(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return desktop;
}

/** Asks for fresh narration links five minutes before the first one expires (API §7). */
function useFreshAudio(
  project: ProjectDetailDto,
  onFresh: (audio: ProjectDetailDto["audio"]) => void,
) {
  useEffect(() => {
    const expiries = Object.values(project.audio).map((link) => Date.parse(link.expiresAt));
    if (expiries.length === 0) return;
    const wait = Math.max(5_000, Math.min(...expiries) - Date.now() - 5 * 60_000);
    const timer = setTimeout(async () => {
      try {
        onFresh(await apiFetch<ProjectDetailDto["audio"]>(`/projects/${project.id}/audio`));
      } catch {
        // Offline for a moment: the next render's timer tries again.
      }
    }, wait);
    return () => clearTimeout(timer);
  }, [project.id, project.audio, onFresh]);
}

export type EditorScreenProps = {
  project: ProjectDetailDto;
  /** "Explainer", from the video type. */
  videoType: string;
};

export function EditorScreen({ project: initial, videoType }: EditorScreenProps) {
  const router = useRouter();
  const [project, setProject] = useState(initial);
  /** The project as last saved: what a failed save goes back to (F21 QA). */
  const lastSaved = useRef(initial);
  const spec = project.draft.spec as VideoSpec;
  const projectId = project.id;
  const lease = useEditLease(projectId);
  const { editorId, lost: leaseLost } = lease;
  const desktop = useDesktop();
  const player = useRef<PlayerRef>(null);
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [saving, setSaving] = useState<"idle" | "saving" | "failed">("idle");
  const [error, setError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [sheet, setSheet] = useState<"scenes" | "style" | null>(null);

  const timeline = useMemo(() => timelineOf(spec), [spec]);
  const current = sceneIndexAt(timeline, frame);
  const assets = useMemo(
    () => Object.fromEntries(Object.entries(project.audio).map(([id, link]) => [id, link.url])),
    [project.audio],
  );
  const unrecorded = spec.scenes.filter((scene) => scene.timing === null).length;
  const totalMs = framesToMs(timeline.total);
  const elsewhere = lease.state.status === "elsewhere";

  useFreshAudio(
    project,
    useCallback((audio: ProjectDetailDto["audio"]) => {
      lastSaved.current = { ...lastSaved.current, audio: { ...lastSaved.current.audio, ...audio } };
      setProject((p) => ({ ...p, audio: { ...p.audio, ...audio } }));
    }, []),
  );

  // Follow the player: its frame and whether it plays.
  useEffect(() => {
    const ref = player.current;
    if (!ref || desktop === null) return;
    const onFrame = (e: { detail: { frame: number } }) => setFrame(e.detail.frame);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    ref.addEventListener("frameupdate", onFrame);
    ref.addEventListener("play", onPlay);
    ref.addEventListener("pause", onPause);
    ref.addEventListener("ended", onPause);
    return () => {
      ref.removeEventListener("frameupdate", onFrame);
      ref.removeEventListener("play", onPlay);
      ref.removeEventListener("pause", onPause);
      ref.removeEventListener("ended", onPause);
    };
  });

  const total = timeline.total;
  const seek = useCallback(
    (to: number) => {
      const target = Math.max(0, Math.min(total - 1, Math.round(to)));
      player.current?.seekTo(target);
      setFrame(target);
    },
    [total],
  );
  const toggle = useCallback(() => player.current?.toggle(), []);
  /** A moment into a scene, once its first elements are in: for thumbnails. */
  const stillOf = (i: number) =>
    timeline.starts[i]! +
    Math.min(timeline.lengths[i]! - 1, Math.round(timeline.lengths[i]! * 0.6));

  // ---- Settings ----

  async function change(next: Partial<QuickSettingsValue>) {
    setError(null);
    // The look changes at once; the server's answer replaces it.
    setProject((p) => {
      const draft = p.draft.spec as VideoSpec;
      return {
        ...p,
        settings: { ...p.settings, ...next },
        draft: {
          ...p.draft,
          spec: {
            ...draft,
            format: next.format ?? draft.format,
            theme: {
              palette: next.palette ?? draft.theme.palette,
              captionStyle: next.captionStyle ?? draft.theme.captionStyle,
            },
          },
        },
      };
    });
    setSaving("saving");
    try {
      const saved = await apiFetch<ProjectDetailDto>(`/projects/${projectId}`, {
        method: "PATCH",
        body: { settings: next },
        editorId,
      });
      lastSaved.current = saved;
      setProject(saved);
      setSaving("idle");
    } catch (failure) {
      // Back to the last saved look, not the page's first one.
      setProject(lastSaved.current);
      if (failure instanceof ApiRequestError && failure.code === "LEASE_HELD") {
        // The read-only notice says why; no second message.
        leaseLost(failure.details);
        setSaving("idle");
        return;
      }
      setSaving("failed");
      setError(
        failure instanceof ApiRequestError ? failure.message : "Couldn't save that. Try again.",
      );
    }
  }

  async function recordNarration() {
    setRecording(true);
    setError(null);
    try {
      await apiFetch<JobDto>(`/projects/${projectId}/narration`, {
        method: "POST",
        idempotent: true,
        editorId,
        body: { baseRev: project.draft.rev },
      });
      router.push(`/projects/${projectId}/generating`);
    } catch (failure) {
      setError(failure instanceof ApiRequestError ? failure.message : "Couldn't start. Try again.");
      setRecording(false);
    }
  }

  // ---- Pieces ----

  const status =
    saving === "saving"
      ? "Saving…"
      : saving === "failed"
        ? "Not saved"
        : elsewhere
          ? "Read only"
          : "Saved";
  const facts = [
    status,
    project.currentVersion ? `version ${project.currentVersion}` : null,
    videoType,
    clock(totalMs),
    spec.language === "hi" ? "Hindi" : "English",
  ].filter(Boolean);

  const settingsValue: QuickSettingsValue = {
    palette: spec.theme.palette,
    captionStyle: spec.theme.captionStyle,
    voiceGender: spec.voice.gender,
    format: spec.format,
  };
  const quickSettings = (className?: string) => (
    <QuickSettings
      value={settingsValue}
      onChange={(next) => void change(next)}
      disabled={elsewhere || saving === "saving"}
      className={className}
    />
  );

  const notices = (
    <>
      {elsewhere ? (
        <Notice>
          This video is open for editing in another tab, so changes here aren’t saved.
          <Button
            size="sm"
            variant="secondary"
            onClick={async () => {
              await lease.takeover();
              setError(null);
              setSaving("idle");
            }}
          >
            Edit here instead
          </Button>
        </Notice>
      ) : null}
      {unrecorded > 0 ? (
        <Notice>
          <span className="flex-1">
            {unrecorded === 1 ? "One scene has" : `${unrecorded} scenes have`} no narration, so{" "}
            {unrecorded === 1 ? "it plays" : "they play"} silently.
          </span>
          <Button
            size="sm"
            loading={recording}
            disabled={elsewhere || recording}
            onClick={() => void recordNarration()}
          >
            Record narration
          </Button>
        </Notice>
      ) : null}
      {error ? <Notice>{error}</Notice> : null}
    </>
  );

  const sceneRows = (onPick?: () => void) =>
    spec.scenes.map((scene, i) => (
      <SceneRow
        key={scene.id}
        index={i + 1}
        title={sceneHeadline(scene) || `Scene ${i + 1}`}
        template={templateLabels[scene.template]}
        duration={seconds(framesToMs(timeline.lengths[i]!))}
        selected={i === current}
        edited={scene.userEdited}
        failed={scene.timing === null}
        badgePlacement="below"
        thumbnail={
          <span className="block size-full">
            <SceneThumbnail spec={spec} frame={stillOf(i)} />
          </span>
        }
        onClick={() => {
          seek(timeline.starts[i]!);
          onPick?.();
        }}
      />
    ));

  const playButton = (size: "md" | "lg") => (
    <button
      type="button"
      onClick={toggle}
      aria-label={playing ? "Pause" : "Play"}
      className={cn(
        "inline-flex shrink-0 cursor-pointer items-center justify-center border-0 bg-brand text-on-brand focus-visible:shadow-[0_0_0_2px_var(--bg),0_0_0_4px_var(--focus-ring)] focus-visible:outline-none",
        size === "lg" ? "size-11 rounded-full" : "size-10 rounded-[10px]",
      )}
    >
      {playing ? (
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <rect x="6" y="5" width="4" height="14" rx="1" />
          <rect x="14" y="5" width="4" height="14" rx="1" />
        </svg>
      ) : (
        <Icon name="play" size={18} />
      )}
    </button>
  );

  const seekBar = (marks: boolean) => (
    <div className="relative flex h-3 flex-1 items-center">
      <div className="pointer-events-none absolute inset-x-0 h-1.5 rounded-[3px] bg-surface-raised">
        <div
          className="h-1.5 rounded-[3px] bg-brand"
          style={{ width: `${(frame / Math.max(1, timeline.total - 1)) * 100}%` }}
        />
        {marks
          ? timeline.starts
              .slice(1)
              .map((start) => (
                <span
                  key={start}
                  aria-hidden="true"
                  className="absolute -top-[3px] h-3 w-0.5 bg-line-strong"
                  style={{ left: `${(start / timeline.total) * 100}%` }}
                />
              ))
          : null}
      </div>
      <input
        type="range"
        aria-label="Seek"
        aria-valuetext={`${clock(framesToMs(frame))} of ${clock(totalMs)}`}
        min={0}
        max={Math.max(0, timeline.total - 1)}
        value={frame}
        onChange={(e) => seek(Number(e.target.value))}
        className="relative h-3 w-full cursor-pointer appearance-none bg-transparent opacity-0 focus-visible:opacity-100"
      />
    </div>
  );

  const stage = (phone: boolean) => (
    <div
      className={cn(
        "relative max-w-full overflow-hidden shadow-lg",
        phone
          ? cn(phoneWidth[spec.format], "rounded-[18px]")
          : cn(stageWidth[spec.format], "rounded-[20px]"),
        aspect[spec.format],
      )}
      data-testid="preview"
      data-format={spec.format}
    >
      <VideoPlayer spec={spec} assets={assets} playerRef={player} />
    </div>
  );

  // ---- Layouts ----

  if (desktop === null) {
    return (
      <div
        data-theme="dark"
        className="-mx-4 -mt-1 -mb-[110px] min-h-dvh bg-bg md:-mx-10 md:-mt-7 md:-mb-12"
      />
    );
  }

  if (!desktop) {
    return (
      <div
        data-theme="dark"
        className="-mx-4 -mt-1 -mb-[110px] flex min-h-dvh flex-col bg-bg text-ink"
      >
        <header className="flex h-14 items-center gap-1 pr-3 pl-1">
          <Link
            href="/library"
            aria-label="Back to library"
            className="inline-flex size-11 items-center justify-center rounded-[12px] text-ink-secondary"
          >
            <ChevronLeft aria-hidden="true" size={22} strokeWidth={1.75} />
          </Link>
          <div className="flex min-w-0 flex-1 flex-col">
            <h1 className="m-0 truncate font-display text-[15px] font-extrabold">
              {project.title}
            </h1>
            <span className="text-[12px] text-ink-muted">{facts.slice(0, 2).join(" · ")}</span>
          </div>
          <Link
            href={`/projects/${projectId}/export`}
            className={buttonClassName({ size: "sm", className: "min-h-9 rounded-[10px] px-3.5" })}
          >
            Export
          </Link>
        </header>
        <div className="flex flex-col gap-3 px-4 pt-1.5">
          {notices}
          <div className="flex justify-center">{stage(true)}</div>
        </div>
        <div className="flex items-center gap-2.5 px-4 pt-3 pb-1.5">
          {playButton("lg")}
          <span className="text-[12px] text-ink-secondary tabular-nums">
            {clock(framesToMs(frame))}
          </span>
          {seekBar(false)}
          <span className="text-[12px] text-ink-muted tabular-nums">{clock(totalMs)}</span>
        </div>
        <ol aria-label="Scenes" className="m-0 flex list-none gap-2 overflow-x-auto px-4 py-2.5">
          {spec.scenes.map((scene, i) => (
            <li key={scene.id} className="relative h-[92px] w-[52px] flex-none">
              {/* The still sits behind the button, so the button is named by its number. */}
              <span
                aria-hidden="true"
                className="absolute inset-0 overflow-hidden rounded-[9px] bg-[var(--video-midnight-bg)]"
              >
                <SceneThumbnail spec={spec} frame={stillOf(i)} />
              </span>
              <button
                type="button"
                aria-label={`Scene ${i + 1}`}
                aria-current={i === current || undefined}
                onClick={() => seek(timeline.starts[i]!)}
                className={cn(
                  "absolute inset-0 flex cursor-pointer items-end rounded-[9px] bg-transparent p-1.5 text-[11px] font-bold text-[var(--video-midnight-text)] tabular-nums",
                  i === current ? "border-2 border-brand" : "border border-line",
                )}
              >
                {i + 1}
              </button>
            </li>
          ))}
        </ol>
        <div className="flex-1" />
        <nav
          aria-label="Editor"
          className="sticky bottom-0 grid grid-cols-2 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]"
        >
          {(
            [
              ["scenes", "Scenes", Rows3],
              ["style", "Style", Palette],
            ] as const
          ).map(([key, label, Glyph]) => (
            <button
              key={key}
              type="button"
              aria-haspopup="dialog"
              onClick={() => setSheet(key)}
              className="flex min-h-14 cursor-pointer flex-col items-center justify-center gap-1 border-0 bg-transparent text-[12px] font-semibold text-ink-secondary"
            >
              <Glyph aria-hidden="true" size={22} strokeWidth={1.75} />
              {label}
            </button>
          ))}
        </nav>
        <Modal
          open={sheet !== null}
          onClose={() => setSheet(null)}
          labelledBy="editor-sheet"
          className="mx-0 mt-auto mb-0 w-full max-w-none rounded-b-none rounded-t-xl"
        >
          <div
            data-theme="dark"
            className="flex max-h-[70dvh] flex-col gap-3 overflow-y-auto bg-surface p-4 text-ink"
          >
            <div className="flex items-center justify-between">
              <h2 id="editor-sheet" className="m-0 font-display text-[17px] font-extrabold">
                {sheet === "style" ? "Style" : `Scenes · ${clock(totalMs)}`}
              </h2>
              <Button size="sm" variant="ghost" onClick={() => setSheet(null)}>
                Done
              </Button>
            </div>
            {sheet === "style" ? quickSettings("border-0 p-0") : sceneRows(() => setSheet(null))}
          </div>
        </Modal>
      </div>
    );
  }

  return (
    <div className="-mx-10 -mt-7 -mb-12 flex min-h-dvh flex-col">
      <header className="flex flex-wrap items-center gap-4 border-b border-line bg-surface px-6 py-3">
        <Link
          href="/library"
          aria-label="Back to library"
          className="inline-flex size-10 items-center justify-center rounded-[10px] text-ink-secondary hover:bg-surface-hover"
        >
          <ChevronLeft aria-hidden="true" size={20} strokeWidth={1.75} />
        </Link>
        <Logo variant="mark" size={28} title="" />
        <div className="flex min-w-0 flex-1 flex-col">
          <h1 className="m-0 truncate font-display text-[18px] font-extrabold">{project.title}</h1>
          <span className="text-[13px] text-ink-muted" aria-live="polite">
            {facts.join(" · ")}
          </span>
        </div>
        <Link
          href={`/projects/${projectId}/export`}
          className={buttonClassName({ className: "min-h-10 rounded-[10px]" })}
        >
          Export and post
          <Icon name="arrow-right" size={16} />
        </Link>
      </header>

      <div className="flex min-h-0 flex-1 flex-wrap">
        <aside
          aria-label="Scenes"
          className="box-border flex max-w-[320px] min-w-0 flex-[1_1_280px] flex-col gap-1 border-r border-line bg-surface px-3 py-4"
        >
          <div className="flex items-center justify-between px-2.5 pt-1 pb-2.5">
            <span className="text-[12px] font-semibold tracking-[0.08em] text-ink-muted uppercase">
              Scenes
            </span>
            <span className="text-[12px] text-ink-muted tabular-nums">
              {spec.scenes.length} · {clock(totalMs)}
            </span>
          </div>
          {sceneRows()}
        </aside>

        <section
          aria-label="Preview"
          data-theme="dark"
          className="box-border flex min-w-0 flex-[999_1_460px] flex-col items-center gap-[18px] bg-bg px-6 pt-6 pb-5 text-ink"
        >
          <div className="flex w-full max-w-[560px] flex-col gap-2 empty:hidden">{notices}</div>
          {stage(false)}
          <div className="flex w-full max-w-[560px] flex-col gap-2">
            {seekBar(true)}
            <div className="flex items-center gap-2">
              {playButton("md")}
              <span className="text-[13px] text-ink-secondary tabular-nums">
                {clock(framesToMs(frame))} / {clock(totalMs)}
              </span>
              <span className="flex-1" />
              <span className="text-[13px] text-ink-muted">
                Scene {current + 1} of {spec.scenes.length}
              </span>
            </div>
          </div>
          {quickSettings("max-w-[560px]")}
        </section>
      </div>
    </div>
  );
}
