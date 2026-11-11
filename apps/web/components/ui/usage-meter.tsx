import { cn } from "./cn";
import { ProgressTrack } from "./progress-bar";

export type UsageMeterProps = {
  used: number;
  max: number;
  /** Names the limit. Default "Videos this month". */
  label?: string;
  /** When it resets: "1 Dec", "midnight". */
  resetsOn?: string;
  className?: string;
};

/** How much of a limit is used. At 80% the bar turns warning. */
export function UsageMeter({
  used,
  max,
  label = "Videos this month",
  resetsOn,
  className,
}: UsageMeterProps) {
  const safeMax = max > 0 ? max : 1;
  const percent = Math.min(100, Math.round((used / safeMax) * 100));
  const near = percent >= 80;
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
        {label}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="font-display text-[28px] font-extrabold leading-[1.1] tabular-nums text-ink">
          {used}
        </span>
        <span className="text-[14px] text-ink-muted">
          of {max}
          {resetsOn ? ` · resets ${resetsOn}` : ""}
        </span>
      </div>
      <ProgressTrack
        percent={percent}
        label={label}
        valueNow={used}
        valueMax={max}
        fillClassName={near ? "bg-warning" : undefined}
      />
    </div>
  );
}
