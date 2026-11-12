"use client";

// "Rename": a small modal with the title field. Native <dialog>, so focus stays inside it and
// Escape closes it.
import { type FormEvent, useEffect, useRef, useState } from "react";
import { Button, TextField } from "@/components/ui";

export function RenameDialog({
  open,
  title,
  onClose,
  onSave,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  onSave: (title: string) => Promise<string | null>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) {
      setError(undefined);
      element.showModal();
    }
    if (!open && element.open) element.close();
  }, [open]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = String(new FormData(event.currentTarget).get("title") ?? "").trim();
    if (!value) return setError("Give the video a title.");
    setBusy(true);
    const failed = await onSave(value);
    setBusy(false);
    if (failed) setError(failed);
  }

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      aria-labelledby="rename-title"
      className="m-auto w-[min(440px,calc(100vw-32px))] rounded-xl border border-line bg-surface p-0 text-ink shadow-lg backdrop:bg-ink/40"
    >
      {open ? (
        <form onSubmit={submit} noValidate className="flex flex-col gap-5 p-6">
          <h2 id="rename-title" className="h3 m-0">
            Rename video
          </h2>
          <TextField
            name="title"
            label="Title"
            defaultValue={title}
            maxLength={100}
            autoFocus
            error={error}
          />
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={busy} disabled={busy}>
              Save title
            </Button>
          </div>
        </form>
      ) : null}
    </dialog>
  );
}
