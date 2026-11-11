import type { ReactNode } from "react";
import { cn } from "./cn";
import { Icon } from "./icon";

export type ToastProps = {
  /** Past tense and specific: "Version 4 saved". */
  children: ReactNode;
  tone?: "default" | "success" | "danger";
  /** At most one action, usually "Undo" or "View". */
  actionLabel?: string;
  onAction?: () => void;
  onClose?: () => void;
  className?: string;
};

export function Toast({
  children,
  tone = "default",
  actionLabel,
  onAction,
  onClose,
  className,
}: ToastProps) {
  const icon = tone === "success" ? "check" : tone === "danger" ? "alert" : null;
  return (
    <div
      role="status"
      className={cn(
        // content-box: 440 px of text plus the padding, as in the design system.
        "box-content flex max-w-[440px] items-center gap-3 rounded-md bg-surface-inverse px-4 py-3 text-[14px] leading-5 text-ink-inverse shadow-md",
        className,
      )}
    >
      {icon ? <Icon name={icon} size={18} /> : null}
      <span className="min-w-0 flex-1">{children}</span>
      {actionLabel ? (
        <button
          type="button"
          onClick={onAction}
          className="cursor-pointer rounded-xs border-0 bg-transparent p-1 font-semibold text-ink-inverse underline underline-offset-3"
        >
          {actionLabel}
        </button>
      ) : null}
      {onClose ? (
        <button
          type="button"
          aria-label="Dismiss"
          onClick={onClose}
          className="inline-flex cursor-pointer rounded-xs border-0 bg-transparent p-1 text-ink-inverse"
        >
          <Icon name="x" size={16} />
        </button>
      ) : null}
    </div>
  );
}
