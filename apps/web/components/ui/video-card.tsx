// A video in the library: a thumbnail drawn in the video's own theme on the stage, the title,
// the type and the status.
import Link from "next/link";
import type { ReactNode } from "react";
import { Badge, type BadgeTone } from "./badge";
import { cn } from "./cn";

export type VideoTheme = "midnight" | "paper" | "ocean" | "sunset";
export type VideoStatus = "draft" | "generating" | "ready" | "scheduled" | "published" | "failed";

export type VideoCardProps = {
  title: string;
  /** Text on the thumbnail; defaults to the title. */
  headline?: string;
  type?: string;
  /** "0:58" */
  duration?: string;
  status?: VideoStatus;
  /** Overrides the badge text, e.g. "Posts 6:30 pm" or "Generating 64%". */
  statusLabel?: ReactNode;
  /** 0-100, shown on the thumbnail while generating. */
  progress?: number;
  theme?: VideoTheme;
  aspect?: "9:16" | "16:9" | "1:1";
  caption?: { before?: string; word: string; after?: string };
  /** Makes the whole card a link to the editor. */
  href?: string;
  className?: string;
  /** Classes for the title line, e.g. room for an actions button beside it. */
  titleClassName?: string;
};

// Video colours are the video's own, not the app's (design system: Video themes). Tailwind only
// generates classes written out in full, so each theme lists its classes literally.
const themes: Record<VideoTheme, { thumb: string; tiles: [string, string, string]; mark: string }> =
  {
    midnight: {
      thumb: "bg-(--video-midnight-bg) text-(--video-midnight-text)",
      tiles: [
        "bg-(--video-midnight-accent)",
        "bg-(--video-midnight-highlight)",
        "bg-(--video-midnight-panel)",
      ],
      mark: "bg-(--video-midnight-highlight) text-(--video-midnight-bg)",
    },
    paper: {
      thumb: "bg-(--video-paper-bg) text-(--video-paper-text) shadow-[inset_0_0_0_1px_var(--line)]",
      tiles: [
        "bg-(--video-paper-accent)",
        "bg-(--video-paper-highlight)",
        "bg-(--video-paper-panel) shadow-[inset_0_0_0_1px_var(--line)]",
      ],
      mark: "bg-(--video-paper-highlight) text-(--video-paper-text)",
    },
    ocean: {
      thumb: "bg-(--video-ocean-bg) text-(--video-ocean-text)",
      tiles: [
        "bg-(--video-ocean-accent)",
        "bg-(--video-ocean-highlight)",
        "bg-(--video-ocean-panel)",
      ],
      mark: "bg-(--video-ocean-highlight) text-(--video-ocean-bg)",
    },
    sunset: {
      thumb: "bg-(--video-sunset-bg) text-(--video-sunset-text)",
      tiles: [
        "bg-(--video-sunset-accent)",
        "bg-(--video-sunset-highlight)",
        "bg-(--video-sunset-panel)",
      ],
      mark: "bg-(--video-sunset-highlight) text-(--video-sunset-bg)",
    },
  };

const statusTones: Record<VideoStatus, BadgeTone> = {
  ready: "success",
  published: "success",
  generating: "brand",
  scheduled: "warning",
  failed: "danger",
  draft: "neutral",
};

const ratios = { "9:16": "9 / 16", "16:9": "16 / 9", "1:1": "1 / 1" };

/**
 * How many lines of title fit above the colour tiles in each shape. A 16:9 thumbnail on a
 * phone card is about 97 px tall: one line there, two from 768 px.
 */
const titleLines = {
  "9:16": "line-clamp-6",
  "16:9": "line-clamp-1 md:line-clamp-2",
  "1:1": "line-clamp-3",
};

/** Text in Devanagari is marked Hindi, so it gets Noto Sans Devanagari (design system: type). */
const langOf = (text: string) => (/[\u0900-\u097F]/.test(text) ? "hi" : undefined);

export function VideoCard({
  title,
  headline,
  type,
  duration,
  status,
  statusLabel,
  progress,
  theme = "midnight",
  aspect = "9:16",
  caption,
  href,
  className,
  titleClassName,
}: VideoCardProps) {
  const colors = themes[theme];
  const content = (
    <>
      {/* The thumbnail is a picture of the video: hidden from assistive tech, so a card reads
          its title once. The lines below carry the title, type, length and status. */}
      <div
        aria-hidden
        className={cn(
          "relative box-border flex max-w-full flex-col justify-between gap-2 overflow-hidden rounded-lg bg-stage p-4",
          colors.thumb,
        )}
        style={{ aspectRatio: ratios[aspect] }}
      >
        <div
          lang={langOf(headline ?? title)}
          className={cn(
            // A utility font class outranks the :lang(hi) base rule, so Hindi names its font here.
            langOf(headline ?? title) ? "font-deva" : "font-display",
            // shrink-0: the column must not squeeze the title to part of a line; the clamp sets
            // how many whole lines show.
            "shrink-0 pr-11 text-[16px] font-extrabold leading-[1.15] tracking-[-0.02em] break-words hyphens-auto",
            titleLines[aspect],
          )}
        >
          {headline ?? title}
        </div>
        <div className="flex gap-1.5">
          {colors.tiles.map((tile, i) => (
            <span key={i} className={cn("size-[26px] rounded-sm", tile)} />
          ))}
        </div>
        {caption ? (
          <div className="text-center text-[11px] font-bold leading-[1.4]">
            {caption.before ? `${caption.before} ` : ""}
            <mark className={cn("rounded-[4px] px-[5px] py-px", colors.mark)}>{caption.word}</mark>
            {caption.after ? ` ${caption.after}` : ""}
          </div>
        ) : null}
        {/* The stage is dark in both themes, so overlays on it use the dark theme's tokens. */}
        {status === "generating" && typeof progress === "number" ? (
          <div data-theme="dark" className="absolute inset-x-3 bottom-2 h-1 rounded-full bg-ink/25">
            <div className="h-full rounded-full bg-ink" style={{ width: `${progress}%` }} />
          </div>
        ) : null}
        {duration ? (
          <span
            data-theme="dark"
            className="absolute right-2.5 top-2.5 rounded-[6px] bg-surface-sunken/72 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-ink"
          >
            {duration}
          </span>
        ) : null}
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        <div
          lang={langOf(title)}
          className={cn(
            "truncate text-[15px] font-semibold leading-[22px] text-ink",
            titleClassName,
          )}
        >
          {title}
        </div>
        <div className="flex items-center gap-2 text-[13px] text-ink-muted">
          {type ? <span>{type}</span> : null}
          {duration ? <span className="sr-only">{`, ${duration} long, `}</span> : null}
          {status ? <Badge tone={statusTones[status]}>{statusLabel ?? status}</Badge> : null}
        </div>
      </div>
    </>
  );

  const classes = cn("flex min-w-0 flex-col gap-3 rounded-lg text-inherit no-underline", className);
  return href ? (
    <Link href={href} className={classes}>
      {content}
    </Link>
  ) : (
    <div className={classes}>{content}</div>
  );
}
