// The monthly video allowance is used up (PRD FR-10.5): say so, and when it comes back.
// Existing videos stay open to edit, preview, export and post (PRD edge cases, Usage).
import { Icon } from "@/components/ui";

export type VideoLimit = { max: number; resetsOn: string };

export function LimitNotice({ limit, className }: { limit: VideoLimit; className?: string }) {
  return (
    <div
      role="status"
      className={`flex items-start gap-3 rounded-[12px] bg-warning-soft px-3.5 py-3 text-[14px] leading-5 text-ink ${className ?? ""}`}
    >
      <Icon name="alert" size={18} className="mt-px shrink-0 text-warning" />
      {limit.max === 0 ? (
        // A limit of 0 is an admin's choice: it doesn't come back on its own, so no reset date.
        <span>
          <strong className="font-semibold">New videos are turned off for this workspace.</strong>{" "}
          Your videos stay open to edit, export and post.
        </span>
      ) : (
        <span>
          <strong className="font-semibold">You’ve used all {limit.max} videos this month.</strong>{" "}
          You can make new videos again on {limit.resetsOn}. Your videos stay open to edit, export
          and post.
        </span>
      )}
    </div>
  );
}
