import type { ButtonHTMLAttributes } from "react";
import { cn } from "./cn";
import { Icon, type IconName } from "./icon";

export type ChipProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  selected?: boolean;
  icon?: IconName;
};

/** A toggle for picking words from a set (video type, tone, angle). Not for status: use Badge. */
export function Chip({ selected = false, icon, className, children, ...rest }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        "inline-flex min-h-8 cursor-pointer items-center gap-1 rounded-full border px-3 py-1.5 text-[13px] font-semibold leading-5",
        selected
          ? "border-ink bg-ink text-bg"
          : "border-line bg-surface text-ink-secondary hover:bg-surface-hover",
        className,
      )}
      {...rest}
    >
      {icon ? <Icon name={icon} size={16} /> : null}
      {children}
    </button>
  );
}
