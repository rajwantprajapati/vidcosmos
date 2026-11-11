import type { ReactNode } from "react";
import { cn } from "./cn";

export type ChatMessageProps = {
  role?: "user" | "assistant";
  children: ReactNode;
  className?: string;
};

/** A bubble in the revision chat. Put messages in a flex column with an 8 px gap. */
export function ChatMessage({ role = "user", children, className }: ChatMessageProps) {
  return (
    <div
      className={cn(
        "box-content max-w-[85%] px-3.5 py-2.5 text-[15px] leading-[22px]",
        role === "user"
          ? "self-end rounded-[16px_16px_4px_16px] bg-surface-inverse text-ink-inverse"
          : "self-start rounded-[16px_16px_16px_4px] bg-surface-sunken text-ink",
        className,
      )}
    >
      {children}
    </div>
  );
}
