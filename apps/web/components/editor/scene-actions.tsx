"use client";

// A scene's actions in the editor (F23): edit, duplicate, move up or down, remove. A small menu
// beside each scene row, opened by its "More" button; Escape or a click outside closes it, and
// focus goes back to the button. Moving is also a keyboard shortcut on the button: Alt+Up and
// Alt+Down (SDD §4: "scene reordering has arrow-key handles").
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/components/ui";

export type SceneAction = "edit" | "duplicate" | "up" | "down" | "remove";

const labels: Record<SceneAction, string> = {
  edit: "Edit scene",
  duplicate: "Duplicate",
  up: "Move up",
  down: "Move down",
  remove: "Remove",
};

export function SceneActions({
  number,
  disabled,
  can,
  onAction,
}: {
  /** 1-based, for the button's name. */
  number: number;
  disabled: boolean;
  /** Which actions apply now (e.g. not "up" for the first scene). */
  can: Record<SceneAction, boolean>;
  onAction: (action: SceneAction) => void;
}) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const box = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pick = (action: SceneAction) => {
    setOpen(false);
    onAction(action);
    if (action !== "edit" && action !== "remove") button.current?.focus();
  };

  return (
    <div ref={box} className="relative shrink-0">
      <button
        ref={button}
        type="button"
        aria-label={`More for scene ${number}`}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(event) => {
          if (!event.altKey) return;
          if (event.key === "ArrowUp" && can.up) {
            event.preventDefault();
            onAction("up");
          } else if (event.key === "ArrowDown" && can.down) {
            event.preventDefault();
            onAction("down");
          }
        }}
        className="inline-flex size-9 cursor-pointer items-center justify-center rounded-[10px] border-0 bg-transparent text-ink-secondary hover:bg-surface-hover hover:text-ink focus-visible:shadow-[0_0_0_2px_var(--bg),0_0_0_4px_var(--focus-ring)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-45"
      >
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="5" cy="12" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="19" cy="12" r="1.8" />
        </svg>
      </button>
      {open ? (
        <div
          id={menuId}
          className="absolute top-full right-0 z-20 mt-1 flex w-44 flex-col rounded-md border border-line bg-surface p-1 shadow-md"
        >
          {(Object.keys(labels) as SceneAction[]).map((action) => (
            <button
              key={action}
              type="button"
              disabled={!can[action]}
              onClick={() => pick(action)}
              className={cn(
                "min-h-10 cursor-pointer rounded-[8px] border-0 bg-transparent px-3 text-left text-[14px] font-medium text-ink hover:bg-surface-hover focus-visible:bg-surface-hover focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-45",
                action === "remove" && "text-danger",
              )}
            >
              {labels[action]}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
