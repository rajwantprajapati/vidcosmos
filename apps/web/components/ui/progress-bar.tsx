import { cn } from "./cn";

type TrackProps = {
  /** Fill width, 0-100. */
  percent: number;
  label: string;
  valueNow: number;
  valueMax: number;
  fillClassName?: string;
};

/** The track and fill shared by ProgressBar and UsageMeter. */
export function ProgressTrack({ percent, label, valueNow, valueMax, fillClassName }: TrackProps) {
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={valueMax}
      aria-valuenow={valueNow}
      aria-label={label}
      className="h-2 overflow-hidden rounded-full bg-surface-sunken"
    >
      <div
        className={cn(
          "h-full rounded-full bg-brand transition-[width] duration-[320ms] ease-[cubic-bezier(0.2,0,0,1)]",
          fillClassName,
        )}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

export type ProgressBarProps = {
  /** 0-100. Only moves forward. */
  value: number;
  /** What is happening now, with counts: "Recording narration (4 of 7 scenes)". */
  label?: string;
  showValue?: boolean;
  /** brand while work runs; danger once it failed; neutral once it stopped. The label says which. */
  tone?: "brand" | "danger" | "neutral";
  /** Announce label changes (each new stage) to screen readers; the percentage isn't announced. */
  live?: boolean;
  className?: string;
};

const fills = { brand: undefined, danger: "bg-danger", neutral: "bg-ink-muted" } as const;

export function ProgressBar({
  value,
  label,
  showValue = true,
  tone = "brand",
  live = false,
  className,
}: ProgressBarProps) {
  const percent = Math.max(0, Math.min(100, Math.round(value || 0)));
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {label || showValue ? (
        <div className="flex justify-between gap-3 text-[13px] leading-5">
          <span className="text-ink-secondary" aria-live={live ? "polite" : undefined}>
            {label ?? ""}
          </span>
          {showValue ? (
            <span className="font-semibold tabular-nums text-ink">{percent}%</span>
          ) : null}
        </div>
      ) : null}
      <ProgressTrack
        percent={percent}
        label={label || "Progress"}
        valueNow={percent}
        valueMax={100}
        fillClassName={fills[tone]}
      />
    </div>
  );
}
