"use client";

// A modal on a create step (native <dialog>, so focus stays inside and Escape closes it).
import { type ReactNode, useEffect, useRef } from "react";
import { cn } from "@/components/ui";

export function Modal({
  open,
  onClose,
  labelledBy,
  className,
  children,
}: {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  /** Size and shape, replacing the small centred card. */
  className?: string;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);
  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      aria-labelledby={labelledBy}
      className={cn(
        "m-auto w-[min(480px,calc(100vw-32px))] rounded-xl border border-line bg-surface p-0 text-ink shadow-lg backdrop:bg-ink/40",
        className,
      )}
    >
      {open ? children : null}
    </dialog>
  );
}
