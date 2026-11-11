import type { ReactNode } from "react";
import { cn } from "./cn";
import { Icon, type IconName } from "./icon";

export type BadgeTone =
  "neutral" | "brand" | "success" | "warning" | "danger" | "info" | "highlight";

export type BadgeProps = {
  /** success Ready/Published, brand Generating, warning Scheduled/Edited, danger Failed, neutral Draft, info tips, highlight brand moments only. */
  tone?: BadgeTone;
  icon?: IconName;
  children?: ReactNode;
  className?: string;
};

const tones: Record<BadgeTone, string> = {
  neutral: "bg-surface-sunken text-ink-secondary",
  brand: "bg-brand-soft text-brand-text",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
  highlight: "bg-highlight text-on-highlight",
};

export function Badge({ tone = "neutral", icon, children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] font-semibold leading-4",
        tones[tone],
        className,
      )}
    >
      {icon ? <Icon name={icon} size={14} /> : null}
      {children}
    </span>
  );
}
