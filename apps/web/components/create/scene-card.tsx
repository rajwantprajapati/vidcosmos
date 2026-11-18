"use client";

// One scene on the storyboard (Storyboard and MobileStoryboard designs): its number and length,
// a small preview in the video's theme, the template picker (desktop), the narration with the
// words each element waits for highlighted, and the elements. A trigger the narrator never
// says, and the scene around it, are marked with the warning colour and a word.
import {
  estimatedSceneMs,
  type Scene,
  sceneElements,
  sceneHeadline,
  type SpecIssue,
  templateLabels,
  type TemplateName,
  templateNames,
  triggerRanges,
  type VideoSpec,
  videoTiming,
} from "@vidcosmos/spec/video";
import { Pencil } from "lucide-react";
import type { CSSProperties } from "react";
import { cn } from "@/components/ui";

type SceneProps = {
  scene: Scene;
  number: number;
  spec: VideoSpec;
  /** This scene's issues. */
  issues: SpecIssue[];
  disabled: boolean;
  onEdit: () => void;
  onTemplate: (template: TemplateName) => void;
};

/** Seconds, as the cards show them ("~5 s"). */
export const sceneSeconds = (scene: Scene, spec: VideoSpec) =>
  Math.max(1, Math.round(estimatedSceneMs(scene, spec.language, spec.voice.speed) / 1000));

/**
 * "~5 s"; a scene longer than 15 s to say says so in the warning colour: it's worth
 * splitting (PRD FR-3.1). It doesn't stop Generate.
 */
function SceneLength({
  scene,
  spec,
  className,
}: {
  scene: Scene;
  spec: VideoSpec;
  className?: string;
}) {
  const seconds = sceneSeconds(scene, spec);
  const long = !scene.timing && seconds * 1000 > videoTiming.maxSceneMs;
  return (
    <span
      title={long ? "Over 15 s: think about splitting it into two scenes" : undefined}
      className={cn(
        "tabular-nums",
        long ? "font-semibold text-warning" : "text-ink-muted",
        className,
      )}
    >
      {long ? `Long scene · ~${seconds} s` : `~${seconds} s`}
    </span>
  );
}

/** The video theme's colours for the small preview. */
const previewStyle = (palette: VideoSpec["theme"]["palette"]) =>
  ({
    "--pv-bg": `var(--video-${palette}-bg)`,
    "--pv-text": `var(--video-${palette}-text)`,
    "--pv-accent": `var(--video-${palette}-accent)`,
    "--pv-highlight": `var(--video-${palette}-highlight)`,
    "--pv-panel": `var(--video-${palette}-panel)`,
  }) as CSSProperties;

/** The narration, with each trigger's words marked; a bad one in the warning colour. */
export function HighlightedNarration({
  scene,
  issues,
  className,
}: {
  scene: Scene;
  issues: SpecIssue[];
  className?: string;
}) {
  const elements = sceneElements(scene);
  const bad = new Set(issues.map((issue) => issue.path));
  const ranges = triggerRanges(
    scene.narration,
    elements.map((element) => element.trigger),
  )
    .map((range, i) => (range ? { ...range, bad: bad.has(elements[i]!.path) } : null))
    .filter((range): range is { start: number; end: number; bad: boolean } => range !== null)
    .sort((a, b) => a.start - b.start);
  const parts: { text: string; mark: "none" | "good" | "bad" }[] = [];
  let at = 0;
  for (const range of ranges) {
    // Overlapping triggers share one highlight.
    if (range.start < at) continue;
    if (range.start > at)
      parts.push({ text: scene.narration.slice(at, range.start), mark: "none" });
    parts.push({
      text: scene.narration.slice(range.start, range.end),
      mark: range.bad ? "bad" : "good",
    });
    at = range.end;
  }
  if (at < scene.narration.length) parts.push({ text: scene.narration.slice(at), mark: "none" });
  return (
    <p className={cn("m-0 text-[14px] leading-[22px] text-ink", className)}>
      {parts.map((part, i) =>
        part.mark === "none" ? (
          <span key={i}>{part.text}</span>
        ) : (
          <mark
            key={i}
            className={cn(
              "rounded-[4px] px-[3px] font-semibold",
              part.mark === "good"
                ? "bg-brand-soft text-brand-text"
                : "bg-warning-soft text-warning",
            )}
          >
            {part.text}
          </mark>
        ),
      )}
    </p>
  );
}

/** A small picture of the scene in the video's theme: its headline and colour swatches. */
function ScenePreview({ scene, spec, small }: { scene: Scene; spec: VideoSpec; small?: boolean }) {
  return (
    <span
      aria-hidden="true"
      style={previewStyle(spec.theme.palette)}
      className={cn(
        "box-border flex flex-col justify-between bg-[var(--pv-bg)] text-[var(--pv-text)]",
        small ? "h-[114px] w-16 flex-none rounded-[10px] p-[7px]" : "h-[132px] rounded-[12px] p-3",
      )}
    >
      <span
        className={cn(
          "line-clamp-4 font-display leading-[1.15] font-extrabold",
          small ? "text-[8px]" : "text-[13px]",
        )}
      >
        {sceneHeadline(scene)}
      </span>
      <span className={cn("flex", small ? "gap-[3px]" : "gap-1.5")}>
        {(small
          ? ["--pv-accent", "--pv-highlight"]
          : ["--pv-accent", "--pv-highlight", "--pv-panel"]
        ).map((colour) => (
          <span
            key={colour}
            style={{ background: `var(${colour})` }}
            className={small ? "size-3 rounded-[3px]" : "size-[22px] rounded-[6px]"}
          />
        ))}
      </span>
    </span>
  );
}

const truncate = (text: string, max: number) =>
  text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;

/** Desktop: the full card with the template picker and the elements as chips. */
export function SceneCard({
  scene,
  number,
  spec,
  issues,
  disabled,
  onEdit,
  onTemplate,
}: SceneProps) {
  const bad = new Set(issues.map((issue) => issue.path));
  const needsFix = issues.length > 0;
  const hindi = spec.language === "hi";
  return (
    <li
      aria-label={`Scene ${number}${needsFix ? ", needs a fix" : ""}`}
      className={cn(
        "flex flex-col gap-3 rounded-[16px] bg-surface p-4",
        needsFix ? "border-2 border-warning" : "border border-line",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-display text-[15px] font-extrabold tabular-nums">Scene {number}</span>
        <span className="flex items-center gap-1">
          <SceneLength scene={scene} spec={spec} className="text-[12px]" />
          <button
            type="button"
            onClick={onEdit}
            disabled={disabled}
            aria-label={`Edit scene ${number}`}
            className="-my-1 -mr-1.5 inline-flex size-8 cursor-pointer items-center justify-center rounded-[8px] border-0 bg-transparent text-ink-secondary hover:bg-surface-sunken hover:text-ink focus-visible:shadow-[0_0_0_2px_var(--bg),0_0_0_4px_var(--focus-ring)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-45"
          >
            <Pencil aria-hidden="true" size={16} strokeWidth={1.75} />
          </button>
        </span>
      </div>
      <ScenePreview scene={scene} spec={spec} />
      <label className="flex items-center gap-2 text-[13px] text-ink-muted">
        Template
        <select
          value={scene.template}
          disabled={disabled}
          onChange={(event) => onTemplate(event.target.value as TemplateName)}
          className="min-h-8 rounded-[8px] border border-line-strong bg-surface px-2 py-1.5 font-sans text-[13px] text-ink focus-visible:shadow-[0_0_0_2px_var(--bg),0_0_0_4px_var(--focus-ring)] focus-visible:outline-none disabled:opacity-60"
        >
          {templateNames.map((name) => (
            <option key={name} value={name}>
              {templateLabels[name]}
            </option>
          ))}
        </select>
      </label>
      {/* A click on the words opens the scene too; keyboards and screen readers use the
          pencil button above, so this stays a plain block that reads normally. */}
      <div
        onClick={disabled ? undefined : onEdit}
        className={cn("flex flex-1 flex-col gap-3", !disabled && "cursor-pointer")}
      >
        <HighlightedNarration scene={scene} issues={issues} className={cn(hindi && "font-deva")} />
        <span className="mt-auto flex flex-wrap gap-1.5">
          {sceneElements(scene).map((element) => (
            <span
              key={element.path}
              className={cn(
                // One line, as in the design: a long label is cut short.
                "max-w-full truncate rounded-full px-2 py-1 text-[12px] leading-4",
                bad.has(element.path)
                  ? "bg-warning-soft text-warning"
                  : "bg-surface-sunken text-ink-secondary",
              )}
            >
              {truncate(element.label, 20)} · on “{element.trigger}”
            </span>
          ))}
        </span>
      </div>
    </li>
  );
}

/** Phones: the whole card is a button that opens the scene (MobileStoryboard). */
export function SceneRow({ scene, number, spec, issues, disabled, onEdit }: SceneProps) {
  const needsFix = issues.length > 0;
  const elements = sceneElements(scene)
    .map((element) => truncate(element.label, 24))
    .join(" · ");
  return (
    <li>
      <button
        type="button"
        onClick={onEdit}
        disabled={disabled}
        className={cn(
          "box-border flex w-full cursor-pointer gap-3 rounded-[16px] bg-surface p-3 text-left font-sans text-ink focus-visible:shadow-[0_0_0_2px_var(--bg),0_0_0_4px_var(--focus-ring)] focus-visible:outline-none disabled:cursor-default",
          needsFix ? "border-2 border-warning" : "border border-line",
        )}
      >
        <ScenePreview scene={scene} spec={spec} small />
        <span className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="flex justify-between gap-2 text-[13px]">
            <span className="font-bold">
              Scene {number} · {templateLabels[scene.template]}
              {needsFix ? <span className="sr-only">, needs a fix</span> : null}
            </span>
            <SceneLength scene={scene} spec={spec} />
          </span>
          <HighlightedNarration
            scene={scene}
            issues={issues}
            className={cn("leading-[21px]", spec.language === "hi" && "font-deva")}
          />
          <span className="text-[12px] text-ink-muted">On screen: {elements}</span>
        </span>
      </button>
    </li>
  );
}
