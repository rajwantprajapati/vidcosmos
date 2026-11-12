"use client";

// A video in the library, with its actions: Rename, Duplicate and Move to Trash; in Trash,
// Restore. Each action calls the projects API and refreshes the list.
import * as Menu from "@radix-ui/react-dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useToast } from "@/components/toaster";
import { Button, cn, VideoCard } from "@/components/ui";
import { apiFetch, ApiRequestError } from "@/lib/api-client";
import type { LibraryCardData } from "@/lib/library";
import { RenameDialog } from "./rename-dialog";

const message = (failure: unknown) =>
  failure instanceof ApiRequestError ? failure.message : "Something went wrong. Try again.";

const itemClass =
  "flex min-h-10 cursor-pointer items-center rounded-md px-3 text-[14px] leading-5 text-ink outline-none data-highlighted:bg-surface-hover";

export function LibraryCard({ card }: { card: LibraryCardData }) {
  const router = useRouter();
  const toast = useToast();
  const [renaming, setRenaming] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const path = `/projects/${card.id}`;

  async function run(action: () => Promise<void>) {
    try {
      await action();
      router.refresh();
    } catch (failure) {
      toast({ message: message(failure), tone: "danger" });
    }
  }

  const restore = () =>
    run(async () => {
      await apiFetch(`${path}/restore`, { method: "POST" });
      toast({ message: `“${card.title}” restored`, tone: "success" });
    });

  /** In Trash, the card leaves the list: focus moves to the next Restore, or back to the library. */
  async function restoreFromTrash() {
    const around = container.current;
    const next =
      around?.nextElementSibling?.querySelector<HTMLElement>("button") ??
      around?.previousElementSibling?.querySelector<HTMLElement>("button") ??
      document.getElementById("trash-back");
    await restore();
    next?.focus();
  }

  const duplicate = () =>
    run(async () => {
      await apiFetch(`${path}/duplicate`, { method: "POST", idempotent: true });
      toast({ message: `Copy of “${card.title}” made` });
    });

  const trash = () => {
    // The card leaves the grid. Focus goes to Undo so a keyboard user can take it back, and
    // when the message closes, to the card that now sits nearby.
    const around = container.current;
    const menuOf = (element: Element | null | undefined) =>
      element?.querySelector<HTMLElement>('button[aria-label^="More actions for"]');
    const neighbour = menuOf(around?.nextElementSibling) ?? menuOf(around?.previousElementSibling);
    return run(async () => {
      await apiFetch(path, { method: "DELETE" });
      toast({
        message: "Moved to Trash",
        actionLabel: "Undo",
        onAction: () => void restore(),
        focusAction: true,
        returnFocus: () => neighbour,
      });
    });
  };

  async function rename(title: string): Promise<string | null> {
    try {
      await apiFetch(path, { method: "PATCH", body: { title } });
    } catch (failure) {
      return message(failure);
    }
    closeRename();
    router.refresh();
    return null;
  }

  /** Back to the card's menu button, where the user started. */
  function closeRename() {
    setRenaming(false);
    setTimeout(() => menuButton.current?.focus(), 0);
  }

  if (card.deletedAt) {
    return (
      <div ref={container} className="flex flex-col gap-2 self-start">
        <VideoCard
          title={card.title}
          type={card.type}
          duration={card.duration}
          status="draft"
          statusLabel="In Trash"
          theme={card.theme}
          aspect={card.aspect}
          className="opacity-80"
        />
        <Button
          variant="secondary"
          size="sm"
          aria-label={`Restore ${card.title}`}
          onClick={() => void restoreFromTrash()}
          className="self-start"
        >
          Restore
        </Button>
      </div>
    );
  }

  return (
    // self-start: a grid row stretches its items to the tallest card, and the menu button is
    // placed from this box's bottom, beside the title.
    <div ref={container} className="relative self-start">
      <VideoCard
        title={card.title}
        type={card.type}
        duration={card.duration}
        status={card.status}
        statusLabel={
          card.shortStatusLabel ? (
            <>
              <span className="md:hidden">{card.shortStatusLabel}</span>
              <span className="hidden md:inline">{card.statusLabel}</span>
            </>
          ) : (
            card.statusLabel
          )
        }
        progress={card.progress}
        theme={card.theme}
        aspect={card.aspect}
        href={card.href}
        titleClassName="pr-8"
      />
      <Menu.Root>
        <Menu.Trigger
          ref={menuButton}
          aria-label={`More actions for ${card.title}`}
          className={cn(
            // Centred on the title line: the badge line below it is 24 px, plus the 4 px gap.
            "absolute right-0 bottom-[23px] inline-flex size-8 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent text-ink-muted",
            "hover:bg-surface-hover hover:text-ink data-[state=open]:bg-surface-hover",
          )}
        >
          <MoreHorizontal aria-hidden="true" size={20} strokeWidth={1.75} />
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Content
            align="end"
            sideOffset={4}
            className="z-50 min-w-44 rounded-lg border border-line bg-surface p-1 shadow-md"
          >
            <Menu.Item className={itemClass} onSelect={() => setRenaming(true)}>
              Rename
            </Menu.Item>
            <Menu.Item className={itemClass} onSelect={() => void duplicate()}>
              Duplicate
            </Menu.Item>
            <Menu.Separator className="my-1 h-px bg-line" />
            <Menu.Item className={cn(itemClass, "text-danger")} onSelect={() => void trash()}>
              Move to Trash
            </Menu.Item>
          </Menu.Content>
        </Menu.Portal>
      </Menu.Root>
      <RenameDialog open={renaming} title={card.title} onClose={closeRename} onSave={rename} />
    </div>
  );
}
