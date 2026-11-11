import type { ButtonHTMLAttributes } from "react";
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
};

export function SceneRow({
  index,
  title,
  template,
  duration,
  selected = false,
  edited = false,
  failed = false,
  className,
  ...rest
}: SceneRowProps) {
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
      <span aria-hidden className="h-[60px] w-[34px] shrink-0 rounded-xs bg-stage" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[14px] font-semibold leading-5">{title}</span>
        <span className="text-[12px] leading-[18px] text-ink-muted">
          {[template, duration].filter(Boolean).join(" · ")}
        </span>
      </span>
      {failed ? (
        <Badge tone="danger" icon="alert">
          No narration
        </Badge>
      ) : edited ? (
        <Badge tone="warning" icon="pencil">
          Edited
        </Badge>
      ) : null}
    </button>
  );
}
