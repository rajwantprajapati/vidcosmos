import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Badge } from "./badge";
import { cn } from "./cn";

export type SceneRowProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** 1-based scene number. */
  index: number;
  title: string;
  /** Template name, e.g. "Flowchart". */
  template?: string;
  /** Seconds with one decimal: "9.8 s". */
  duration?: string;
  selected?: boolean;
  /** Changed by hand. */
  edited?: boolean;
  /** Narration failed and needs a retry. */
  failed?: boolean;
  /** A still of the scene, in place of the plain 34×60 tile. */
  thumbnail?: ReactNode;
  /**
   * Where the badge sits: at the end of the row (the design), or under the title, which keeps
   * the title readable in a narrow list where many rows have one (the editor).
   */
  badgePlacement?: "end" | "below";
};

export function SceneRow({
  index,
  title,
  template,
  duration,
  selected = false,
  edited = false,
  failed = false,
  thumbnail,
  badgePlacement = "end",
  className,
  ...rest
}: SceneRowProps) {
  const badge = (className?: string) =>
    failed ? (
      <Badge tone="danger" icon="alert" className={className}>
        No narration
      </Badge>
    ) : edited ? (
      <Badge tone="warning" icon="pencil" className={className}>
        Edited
      </Badge>
    ) : null;
  return (
    <button
      type="button"
      aria-current={selected || undefined}
      className={cn(
        "flex w-full cursor-pointer items-center gap-3 rounded-[12px] border p-2.5 text-left text-ink",
        selected
          ? "border-brand-soft-line bg-brand-soft"
          : "border-transparent bg-transparent hover:bg-surface-hover",
        className,
      )}
      {...rest}
    >
      <span
        className={cn(
          "w-5 text-[12px] font-semibold tabular-nums",
          selected ? "text-brand-text" : "text-ink-muted",
        )}
      >
        {String(index).padStart(2, "0")}
      </span>
      <span aria-hidden className="h-[60px] w-[34px] shrink-0 overflow-hidden rounded-xs bg-stage">
        {thumbnail}
      </span>
      <span className="flex min-w-0 flex-1 flex-col items-start">
        <span className="max-w-full truncate text-[14px] font-semibold leading-5">{title}</span>
        <span className="text-[12px] leading-[18px] text-ink-muted">
          {[template, duration].filter(Boolean).join(" · ")}
        </span>
        {badgePlacement === "below" ? badge("mt-1") : null}
      </span>
      {badgePlacement === "end" ? badge() : null}
    </button>
  );
}
