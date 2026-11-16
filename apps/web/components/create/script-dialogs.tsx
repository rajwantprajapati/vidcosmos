"use client";

// The two questions step 2 asks in a small modal (native <dialog>, so focus stays inside and
// Escape closes it): how to rewrite ("Custom…"), and whether to replace a script the person
// edited with a new one (API §6, `needs: 'overwrite'`).
import { type FormEvent, type ReactNode, useEffect, useRef, useState } from "react";
import { Button, TextField } from "@/components/ui";

function Modal({
  open,
  onClose,
  labelledBy,
  children,
}: {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
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
      className="m-auto w-[min(480px,calc(100vw-32px))] rounded-xl border border-line bg-surface p-0 text-ink shadow-lg backdrop:bg-ink/40"
    >
      {open ? children : null}
    </dialog>
  );
}

export function CustomRewriteDialog({
  open,
  selected,
  onClose,
  onRewrite,
}: {
  open: boolean;
  /** Only the selected part is rewritten. */
  selected: boolean;
  onClose: () => void;
  onRewrite: (instruction: string) => void;
}) {
  const [error, setError] = useState<string>();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = String(new FormData(event.currentTarget).get("custom") ?? "").trim();
    if (!value) return setError("Say how the script should change.");
    setError(undefined);
    onRewrite(value);
  }

  return (
    <Modal open={open} onClose={onClose} labelledBy="custom-rewrite-title">
      <form onSubmit={submit} noValidate className="flex flex-col gap-5 p-6">
        <div className="flex flex-col gap-1.5">
          <h2 id="custom-rewrite-title" className="h3 m-0">
            {selected ? "Rewrite the selected part" : "Rewrite the script"}
          </h2>
          <p className="m-0 text-[14px] text-ink-secondary">Uses 1 AI request for this video.</p>
        </div>
        <TextField
          name="custom"
          label="How should it change?"
          multiline
          rows={3}
          maxLength={500}
          placeholder="For example: use a cricket example instead"
          autoFocus
          error={error}
          onChange={() => setError(undefined)}
        />
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" icon="sparkles">
            Rewrite
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function OverwriteDialog({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} labelledBy="overwrite-title">
      <div className="flex flex-col gap-5 p-6">
        <div className="flex flex-col gap-2">
          <h2 id="overwrite-title" className="h3 m-0">
            Replace your edited script?
          </h2>
          <p className="m-0 text-[15px] leading-[23px] text-ink-secondary">
            You’ve changed this script. A new script replaces it, and your changes are lost. It uses
            1 AI request for this video.
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>
            Keep my script
          </Button>
          <Button variant="danger" onClick={onConfirm}>
            Write a new script
          </Button>
        </div>
      </div>
    </Modal>
  );
}
