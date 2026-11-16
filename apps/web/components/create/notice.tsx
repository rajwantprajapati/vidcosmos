// A warning banner on a create step: another tab is editing, or an earlier step changed.
import type { ReactNode } from "react";
import { cn, Icon } from "@/components/ui";

export function Notice({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      role="status"
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-[12px] bg-warning-soft px-3.5 py-3 text-[14px] leading-5 text-ink",
        className,
      )}
    >
      <Icon name="alert" size={18} className="shrink-0 text-warning" />
      {children}
    </div>
  );
}
