// Unsaved edits kept in the browser (SDD §4 "Autosave", F22): when a save can't reach the
// server, the latest draft (with the `rev` it was based on) and the latest settings change
// wait here, in IndexedDB, until they can be sent. One entry per video. They survive a reload
// or a closed tab, and they're sent with their old `rev`, so a change made elsewhere meanwhile
// is caught as a conflict rather than overwritten.
//
// Without IndexedDB (a private window that blocks it), the entries live in memory for the
// page's life instead.
import type { VideoSpec } from "@vidcosmos/spec/video";

export type PendingSettings = Partial<{
  palette: VideoSpec["theme"]["palette"];
  captionStyle: VideoSpec["theme"]["captionStyle"];
  voiceGender: VideoSpec["voice"]["gender"];
  format: VideoSpec["format"];
}>;

export type PendingEdits = {
  projectId: string;
  /**
   * The draft not yet saved, the rev it was based on, and the tab that made it: only that tab
   * puts it back by itself; another tab offers it (F22 QA).
   */
  draft?: { baseRev: number; spec: VideoSpec; editorId: string; keptAt: string };
  /** Settings changes not yet saved, latest value of each, and the tab that made them. */
  settings?: { patch: PendingSettings; editorId: string; keptAt: string };
};

const dbName = "vidcosmos";
const storeName = "pending-edits";

const memory = new Map<string, PendingEdits>();

function open(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(dbName, 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore(storeName, { keyPath: "projectId" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function withStore(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest,
): Promise<unknown> {
  const db = await open();
  if (!db) return undefined;
  return new Promise((resolve) => {
    try {
      const request = run(db.transaction(storeName, mode).objectStore(storeName));
      request.onsuccess = () => resolve(request.result as unknown);
      request.onerror = () => resolve(undefined);
    } catch {
      resolve(undefined);
    } finally {
      db.close();
    }
  });
}

/** What's kept for a video, if anything. */
export async function readPending(projectId: string): Promise<PendingEdits | null> {
  const stored = (await withStore("readonly", (s) => s.get(projectId))) as PendingEdits | undefined;
  return stored ?? memory.get(projectId) ?? null;
}

async function write(entry: PendingEdits): Promise<void> {
  const empty = !entry.draft && !entry.settings;
  if (empty) memory.delete(entry.projectId);
  else memory.set(entry.projectId, entry);
  await withStore("readwrite", (s) => (empty ? s.delete(entry.projectId) : s.put(entry)));
}

/** Keeps this draft (replacing any earlier one), with the rev it was based on. */
export async function keepDraft(
  projectId: string,
  baseRev: number,
  spec: VideoSpec,
  editorId: string,
) {
  const current = (await readPending(projectId)) ?? { projectId };
  await write({
    ...current,
    draft: { baseRev, spec, editorId, keptAt: new Date().toISOString() },
  });
}

/** Adds a settings change to what's kept: the latest value of each setting wins. */
export async function keepSettings(projectId: string, patch: PendingSettings, editorId: string) {
  const current = (await readPending(projectId)) ?? { projectId };
  // Another tab's kept settings aren't merged into this tab's.
  const earlier = current.settings?.editorId === editorId ? current.settings.patch : undefined;
  await write({
    ...current,
    settings: {
      patch: mergeSettings(earlier, patch),
      editorId,
      keptAt: new Date().toISOString(),
    },
  });
}

export const mergeSettings = (
  earlier: PendingSettings | undefined,
  later: PendingSettings,
): PendingSettings => ({ ...earlier, ...later });

/** The draft was saved (or given up): it's no longer kept. */
export async function dropDraft(projectId: string) {
  const current = await readPending(projectId);
  if (current?.draft) await write({ ...current, draft: undefined });
}

/** The settings were saved: they're no longer kept. */
export async function dropSettings(projectId: string) {
  const current = await readPending(projectId);
  if (current?.settings) await write({ ...current, settings: undefined });
}

/** A failed request that never reached the server (offline, DNS, a dropped connection). */
export const isOffline = (error: unknown) =>
  error instanceof TypeError || (typeof navigator !== "undefined" && navigator.onLine === false);
