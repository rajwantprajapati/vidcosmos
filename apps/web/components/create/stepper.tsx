// The four steps of making a video (Stepper design): Idea, Script, Storyboard, Video. On
// desktop, numbered dots joined by lines; on phones, "Step 1 of 4 · Idea" and four bars.
import { Check } from "lucide-react";
import { cn } from "@/components/ui";

export const createSteps = ["Idea", "Script", "Storyboard", "Video"] as const;

/** `step` is 1-4. */
export function Stepper({ step, className }: { step: number; className?: string }) {
  return (
    <nav aria-label="Steps to make a video" className={className}>
      <ol className="m-0 flex list-none flex-wrap items-center gap-3 p-0">
        {createSteps.map((label, index) => {
          const n = index + 1;
          const done = n < step;
          const current = n === step;
          return (
            <li
              key={label}
              aria-current={current ? "step" : undefined}
              className="flex items-center gap-3"
            >
              {index > 0 ? (
                <span
                  aria-hidden="true"
                  className={cn("h-0.5 w-10 rounded-sm", n <= step ? "bg-brand" : "bg-line")}
                />
              ) : null}
              <span
                className={cn(
                  "box-border inline-flex size-7 items-center justify-center rounded-full text-[13px] font-bold tabular-nums",
                  done && "bg-brand text-on-brand",
                  current && "border-2 border-brand-text bg-brand-soft text-brand-text",
                  !done && !current && "border border-line-strong bg-surface text-ink-muted",
                )}
              >
                {done ? <Check aria-hidden="true" size={14} strokeWidth={3} /> : n}
              </span>
              <span
                className={cn(
                  "text-[14px]",
                  current ? "font-bold" : "font-medium",
                  current || done ? "text-ink" : "text-ink-muted",
                )}
              >
                {done ? <span className="sr-only">Done: </span> : null}
                {label}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** The phone version: four bars, the current one and those before it filled. */
export function StepBars({ step }: { step: number }) {
  return (
    <div aria-hidden="true" className="grid grid-cols-4 gap-1 px-4">
      {createSteps.map((label, index) => (
        <span
          key={label}
          className={cn("h-1 rounded-sm", index + 1 <= step ? "bg-brand" : "bg-line")}
        />
      ))}
    </div>
  );
}
