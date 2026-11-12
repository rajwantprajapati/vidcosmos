import { cn } from "@/components/ui";

/** The user's initials in a brand-tinted circle (no photos in V1). */
export function Avatar({
  initials,
  size = 36,
  className,
}: {
  initials: string;
  size?: 34 | 36;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-brand-soft font-bold text-brand-text",
        size === 36 ? "size-9 text-[14px]" : "size-[34px] text-[13px]",
        className,
      )}
    >
      {initials}
    </span>
  );
}
