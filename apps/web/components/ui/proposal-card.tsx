import { Badge } from "./badge";
import { Button } from "./button";
import { cn } from "./cn";
import { Icon } from "./icon";

export type ProposalStatus = "proposed" | "applied" | "dismissed" | "stale";

export type ProposalCardProps = {
  /** One or two plain sentences, first person: "I'll cut the intro to one sentence…". */
  summary: string;
  /** Affected scenes: "Scenes 1, 3". */
  scenes?: string;
  /** Narration will be recorded again. */
  regeneratesVoice?: boolean;
  /** The new length: "52 s". */
  duration?: string;
  warnings?: string[];
  status?: ProposalStatus;
  /** The version created when applied. */
  version?: number;
  onApply?: () => void;
  onDismiss?: () => void;
  applyLabel?: string;
  className?: string;
};

export function ProposalCard({
  summary,
  scenes,
  regeneratesVoice = false,
  duration,
  warnings = [],
  status = "proposed",
  version,
  onApply,
  onDismiss,
  applyLabel = "Apply",
  className,
}: ProposalCardProps) {
  const hasBadges = Boolean(scenes || regeneratesVoice || duration);
  return (
    <div
      className={cn(
        "box-content flex max-w-[440px] flex-col gap-3 rounded-[16px_16px_16px_4px] border border-line p-4",
        status === "dismissed" || status === "stale" ? "bg-surface-sunken" : "bg-surface",
        className,
      )}
    >
      <p className="m-0 text-[15px] leading-[22px] text-ink">{summary}</p>
      {hasBadges ? (
        <div className="flex flex-wrap gap-1.5">
          {scenes ? <Badge tone="brand">{scenes}</Badge> : null}
          {regeneratesVoice ? (
            <Badge tone="warning" icon="mic">
              New narration
            </Badge>
          ) : null}
          {duration ? (
            <Badge tone="neutral" icon="clock">
              {duration}
            </Badge>
          ) : null}
        </div>
      ) : null}
      {warnings.map((warning) => (
        <p key={warning} className="m-0 flex items-center gap-1.5 text-[13px] text-warning">
          <Icon name="alert" size={14} />
          {warning}
        </p>
      ))}
      {status === "proposed" ? (
        <div className="flex gap-2">
          <Button size="sm" onClick={onApply}>
            {applyLabel}
          </Button>
          <Button size="sm" variant="secondary" onClick={onDismiss}>
            Dismiss
          </Button>
        </div>
      ) : (
        <p
          className={cn(
            "m-0 flex items-center gap-1.5 text-[13px] font-semibold",
            status === "applied" ? "text-success" : "text-ink-muted",
          )}
        >
          {status === "applied" ? <Icon name="check" size={16} /> : null}
          {status === "applied"
            ? `Applied${version ? ` as version ${version}` : ""}`
            : status === "stale"
              ? "The video changed since this was suggested. Ask again."
              : "Dismissed"}
        </p>
      )}
    </div>
  );
}
