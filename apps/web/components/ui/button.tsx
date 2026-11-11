import type { ButtonHTMLAttributes } from "react";
import { cn } from "./cn";
import { Icon, type IconName } from "./icon";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** primary: the one main action per view. secondary: outlined. ghost: text only. danger: destructive. */
  variant?: "primary" | "secondary" | "ghost" | "danger";
  /** sm 32 px, md 40 px, lg 48 px tall. */
  size?: "sm" | "md" | "lg";
  icon?: IconName;
  iconEnd?: IconName;
  /** Spinner in place of the leading icon and aria-busy. Change the label to the progressive ("Generating…"). */
  loading?: boolean;
  fullWidth?: boolean;
};

const variants = {
  primary: "bg-brand text-on-brand hover:not-disabled:bg-brand-hover",
  secondary: "border-line-strong bg-surface text-ink hover:not-disabled:bg-surface-hover",
  ghost: "bg-transparent text-brand-text hover:not-disabled:bg-surface-hover",
  danger: "bg-danger-fill text-on-danger",
};

const sizes = {
  sm: "min-h-8 px-3 py-1.5 text-[13px] leading-5",
  md: "min-h-10 px-4 py-2.5 text-[14px] leading-5",
  lg: "min-h-12 rounded-[12px] px-6 py-3 text-[16px] leading-6",
};

/**
 * The button look for something that is not a `<button>`, such as a link that leads to the
 * next step. Disabled styles don't apply: a link is never disabled.
 */
export function buttonClassName({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className,
}: Pick<ButtonProps, "variant" | "size" | "fullWidth" | "className"> = {}) {
  return cn(
    "inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md border border-transparent font-semibold no-underline",
    "transition-[background-color,transform] duration-[120ms,80ms] ease-[cubic-bezier(0.2,0,0,1)] active:scale-[0.98]",
    variants[variant].replaceAll("hover:not-disabled:", "hover:"),
    sizes[size],
    fullWidth && "w-full",
    className,
  );
}

export function Button({
  variant = "primary",
  size = "md",
  icon,
  iconEnd,
  loading = false,
  fullWidth = false,
  type = "button",
  className,
  children,
  ...rest
}: ButtonProps) {
  const iconSize = size === "sm" ? 16 : 18;
  const lead = loading ? "loader" : icon;
  return (
    <button
      type={type}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md border border-transparent font-semibold",
        "transition-[background-color,transform] duration-[120ms,80ms] ease-[cubic-bezier(0.2,0,0,1)] active:not-disabled:scale-[0.98]",
        "disabled:cursor-not-allowed disabled:opacity-45",
        variants[variant],
        sizes[size],
        fullWidth && "w-full",
        loading && "cursor-progress",
        className,
      )}
      {...rest}
    >
      {lead ? <Icon name={lead} size={iconSize} /> : null}
      {children ? <span>{children}</span> : null}
      {iconEnd ? <Icon name={iconEnd} size={iconSize} /> : null}
    </button>
  );
}
