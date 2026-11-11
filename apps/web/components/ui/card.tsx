import type { ElementType, HTMLAttributes } from "react";
import { cn } from "./cn";

export type CardProps = HTMLAttributes<HTMLElement> & {
  padding?: "sm" | "md" | "lg";
  /** Lifts with shadow-sm on hover. */
  interactive?: boolean;
  /** The chosen card in a set. */
  selected?: boolean;
  as?: ElementType;
};

const paddings = { sm: "p-4", md: "p-6", lg: "p-8" };

export function Card({
  padding = "md",
  interactive = false,
  selected = false,
  as: Element = "div",
  className,
  ...rest
}: CardProps) {
  return (
    <Element
      className={cn(
        "rounded-lg border border-line bg-surface text-ink",
        paddings[padding],
        interactive && "cursor-pointer transition-shadow duration-[120ms] hover:shadow-sm",
        selected && "border-brand-soft-line bg-brand-soft",
        className,
      )}
      {...rest}
    />
  );
}
