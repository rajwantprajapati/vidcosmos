"use client";

// Draft autosave (SDD §4 "Autosave", API §5 "Draft autosave", F22): no edit is ever lost, and
// two tabs never overwrite each other.
// - Saves 1.5 s after the last change, as `PUT /projects/{id}/draft` with the `rev` it was
//   based on: "Saving…", then "Saved". One save at a time: a change made while one is in
//   flight is saved after it, with the rev it returned.
// - Every unsaved change is kept in the browser at once (`offline-drafts.ts`), tagged with this
//   tab. When a save can't reach the server, the status is "Offline – changes kept locally" and
//   the save is tried again when the connection is back, or on the next visit.
// - `409 REV_CONFLICT`: the draft changed elsewhere. Nothing is overwritten: the page shows the
//   server's version and gets this tab's draft back to offer ("Use my changes").
// - `423 LEASE_HELD`: another tab took over; the page turns read-only.
// - Leaving: an in-app link sends the last change with a keep-alive request; closing the tab
//   hands it to the lease release (`setFinalDraft`), which saves it before letting go.
// - A draft kept from an earlier visit is put back silently only for the same tab over the same
//   rev; anything else (another tab's, or over an older rev) is offered, never applied.
import type { DraftSavedDto, ProjectDetailDto } from "@vidcosmos/spec/api";
import { canonicalJson, type VideoSpec } from "@vidcosmos/spec/video";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch, ApiRequestError } from "@/lib/api-client";
import { dropDraft, isOffline, keepDraft, readPending } from "@/lib/offline-drafts";

export const autosaveMs = 1_500;
/** While offline, how often to try again besides the browser's "online" event. */
export const offlineRetryMs = 10_000;
/** A change is kept in the browser this soon after it's made. */
const keepMs = 150;

/** This tab handed its last change to the lease release as it closed (sessionStorage). */
const handedOffKey = (projectId: string) => `vidcosmos.handedOff.${projectId}`;
/** How long after closing the reloaded page looks for that change on the server. */
const handOffWaitMs = 8_000;

export type AutosaveStatus = "idle" | "saving" | "saved" | "offline" | "failed";

/** What the status line says. */
export function autosaveLabel(status: AutosaveStatus, dirty: boolean): string {
  if (status === "offline") return "Offline – changes kept locally";
  if (status === "saving" || (dirty && status !== "failed")) return "Saving…";
  if (status === "failed") return "Not saved";
  return status === "saved" ? "Saved just now" : "Saved";
}

export type FinalDraft = { baseRev: number; spec: VideoSpec } | null;

/**
 * Whether two drafts say the same: title and scenes (template, narration, content). Timing and
 * `userEdited` are left out: the server sets them on save.
 */
export function sameDraft(a: VideoSpec | null, b: VideoSpec | null): boolean {
  if (!a || !b) return a === b;
  const words = (spec: VideoSpec) => ({
    title: spec.title,
    scenes: spec.scenes.map(({ id, template, narration, content }) => ({
      id,
      template,
      narration,
      content,
    })),
  });
  return canonicalJson(words(a)) === canonicalJson(words(b));
}

export type DraftAutosaveOptions = {
  projectId: string;
  editorId: string;
  spec: VideoSpec | null;
  /** The draft and rev the page opened with. */
  initial: { spec: VideoSpec | null; rev: number };
  /** No saving: read-only, or a job is running. */
  paused: boolean;
  /** The server's newer version, and this tab's draft that wasn't saved over it. */
  onConflict: (fresh: ProjectDetailDto, mine: VideoSpec) => void;
  onLeaseLost: (details?: Record<string, unknown>) => void;
  /** This tab's draft kept from before a reload, over the same rev: put it back. */
  onRestore: (spec: VideoSpec) => void;
  /** A draft kept by another tab, or over an older rev: offer it, don't apply it. */
  onKept: (spec: VideoSpec) => void;
  /** Gives the lease release what to save when the tab closes (`useEditLease`). */
  setFinalDraft?: (get: () => FinalDraft) => void;
  /**
   * The server has a newer draft than the page opened with: this tab's last change, saved by
   * the release as it closed, after the reloaded page was already on its way.
   */
  onServerNewer?: (fresh: ProjectDetailDto) => void;
  onSaved?: (saved: DraftSavedDto) => void;
};

export function useDraftAutosave(options: DraftAutosaveOptions) {
  const { projectId, editorId, spec, paused } = options;
  const [savedSpec, setSavedSpec] = useState<VideoSpec | null>(options.initial.spec);
  const [rev, setRev] = useState(options.initial.rev);
  const [status, setStatus] = useState<AutosaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const dirty = spec !== null && spec !== savedSpec;

  // The latest values, for saves and leaving, which run after the render that started them.
  const specRef = useRef(spec);
  const savedRef = useRef(options.initial.spec);
  const revRef = useRef(options.initial.rev);
  const pausedRef = useRef(paused);
  const handlers = useRef(options);
  useEffect(() => {
    specRef.current = spec;
    pausedRef.current = paused;
    handlers.current = options;
  });
  /** The page is looking for the change this tab handed off as it closed. */
  const handingOff = useRef(false);
  /** Saves run one after another. */
  const queue = useRef<Promise<boolean>>(Promise.resolve(true));

  const markSaved = useCallback((next: VideoSpec | null, nextRev: number) => {
    savedRef.current = next;
    revRef.current = nextRev;
    setSavedSpec(next);
    setRev(nextRev);
  }, []);

  /** The server has this draft and rev now (after a job, a takeover or a conflict). */
  const reset = useCallback(
    (fresh: VideoSpec | null, freshRev: number) => {
      markSaved(fresh, freshRev);
      setStatus("idle");
      setError(null);
    },
    [markSaved],
  );

  const saveOnce = useCallback(async (): Promise<boolean> => {
    const snapshot = specRef.current;
    if (!snapshot || snapshot === savedRef.current) return true;
    const baseRev = revRef.current;
    setStatus("saving");
    try {
      const saved = await apiFetch<DraftSavedDto>(`/projects/${projectId}/draft`, {
        method: "PUT",
        body: { baseRev, spec: snapshot },
        editorId,
      });
      markSaved(snapshot, saved.rev);
      // A change made meanwhile is still unsaved: keep it over the new rev.
      const now = specRef.current;
      if (now && now !== snapshot) await keepDraft(projectId, saved.rev, now, editorId);
      else await dropDraft(projectId);
      setStatus("saved");
      setError(null);
      handlers.current.onSaved?.(saved);
      return true;
    } catch (failure) {
      if (failure instanceof ApiRequestError && failure.code === "REV_CONFLICT") {
        // Changed elsewhere: show the server's version and offer this draft back. It stays
        // kept in the browser until it's used or discarded.
        const mine = specRef.current ?? snapshot;
        const fresh = await apiFetch<ProjectDetailDto>(`/projects/${projectId}`);
        markSaved(fresh.draft.spec, fresh.draft.rev);
        setStatus("idle");
        handlers.current.onConflict(fresh, mine);
        return false;
      }
      if (failure instanceof ApiRequestError && failure.code === "LEASE_HELD") {
        // Kept, tagged with this tab: another tab that opens the video offers it, never
        // applies it.
        setStatus("failed");
        handlers.current.onLeaseLost(failure.details);
        return false;
      }
      if (isOffline(failure) || !(failure instanceof ApiRequestError)) {
        setStatus("offline");
        return false;
      }
      setStatus("failed");
      setError(failure.message);
      return false;
    }
  }, [projectId, editorId, markSaved]);

  /** Queues a save of the latest draft; resolves once it's done. */
  const save = useCallback(() => {
    queue.current = queue.current.then(saveOnce, saveOnce);
    return queue.current;
  }, [saveOnce]);

  // Keep every change in the browser at once, so nothing is lost if the page goes away.
  useEffect(() => {
    if (!dirty || !spec) return;
    const timer = setTimeout(
      () => void keepDraft(projectId, revRef.current, spec, editorId),
      keepMs,
    );
    return () => clearTimeout(timer);
  }, [dirty, spec, projectId, editorId]);

  // Save a moment after the last change, never while a save is in flight.
  useEffect(() => {
    if (!dirty || paused || status === "failed" || status === "offline" || status === "saving") {
      return;
    }
    const timer = setTimeout(() => void save(), autosaveMs);
    return () => clearTimeout(timer);
  }, [dirty, paused, status, save]);

  // Offline: try again when the connection is back, and every so often anyway.
  useEffect(() => {
    if (status !== "offline" || paused) return;
    const retry = () => void save();
    window.addEventListener("online", retry);
    const timer = setInterval(retry, offlineRetryMs);
    return () => {
      window.removeEventListener("online", retry);
      clearInterval(timer);
    };
  }, [status, paused, save]);

  // This tab's last change went with the release as it closed: the server may save it just
  // after this page was rendered, so look for it and show it once it's there.
  useEffect(() => {
    // The note is removed only once the look is over, so an effect that runs again (React's
    // development double run) picks it up again.
    let raw: string | null = null;
    try {
      raw = sessionStorage.getItem(handedOffKey(projectId));
    } catch {
      return;
    }
    const done = () => {
      try {
        sessionStorage.removeItem(handedOffKey(projectId));
      } catch {
        // Blocked: it expires on its own (`handOffWaitMs`).
      }
    };
    const handed = raw ? (JSON.parse(raw) as { baseRev: number; at: number }) : null;
    if (!handed || Date.now() - handed.at > handOffWaitMs || options.initial.rev > handed.baseRev) {
      if (handed) done();
      return;
    }
    handingOff.current = true;
    let stopped = false;
    const until = Date.now() + handOffWaitMs;
    const look = async () => {
      if (stopped) return;
      if (Date.now() > until) {
        // It never arrived (refused, or a conflict): offer the copy kept in the browser.
        handingOff.current = false;
        done();
        const kept = (await readPending(projectId))?.draft;
        if (kept && !stopped) handlers.current.onKept(kept.spec);
        return;
      }
      const fresh = await apiFetch<ProjectDetailDto>(`/projects/${projectId}`).catch(() => null);
      if (stopped) return;
      if (fresh && fresh.draft.rev > handed.baseRev && specRef.current === savedRef.current) {
        markSaved(fresh.draft.spec, fresh.draft.rev);
        handingOff.current = false;
        done();
        await dropDraft(projectId);
        handlers.current.onServerNewer?.(fresh);
        return;
      }
      setTimeout(() => void look(), 500);
    };
    void look();
    return () => {
      stopped = true;
    };
    // Once, on open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // A draft kept from an earlier visit.
  useEffect(() => {
    let stopped = false;
    void (async () => {
      const pending = await readPending(projectId);
      const kept = pending?.draft;
      // The change this tab handed off as it closed is being looked for on the server.
      if (stopped || !kept || handingOff.current) return;
      // Already saved (a keep-alive save on leaving by a link, which can't drop the copy after
      // it): nothing to offer (F22 QA).
      if (sameDraft(kept.spec, options.initial.spec)) {
        await dropDraft(projectId);
        return;
      }
      if (kept.editorId === editorId && kept.baseRev === options.initial.rev) {
        handlers.current.onRestore(kept.spec);
      } else {
        handlers.current.onKept(kept.spec);
      }
    })();
    return () => {
      stopped = true;
    };
    // Once, on open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Closing the tab: the lease release saves the last unsaved change before letting go.
  useEffect(() => {
    options.setFinalDraft?.(() => {
      const latest = specRef.current;
      if (!latest || latest === savedRef.current || pausedRef.current) return null;
      // Noted at once (sessionStorage is synchronous), so the reloaded page knows to look for it.
      try {
        sessionStorage.setItem(
          handedOffKey(projectId),
          JSON.stringify({ baseRev: revRef.current, at: Date.now() }),
        );
      } catch {
        // Storage blocked: the reloaded page shows the server's draft as it found it.
      }
      return { baseRev: revRef.current, spec: latest };
    });
    // Once: it reads the latest values when the tab closes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Leaving by an in-app link: send the last change with a keep-alive request.
  useEffect(() => {
    const specs = specRef;
    const saved = savedRef;
    const revs = revRef;
    const stopped = pausedRef;
    return () => {
      const latest = specs.current;
      if (!latest || latest === saved.current || stopped.current) return;
      void fetch(`/api/v1/projects/${projectId}/draft`, {
        method: "PUT",
        keepalive: true,
        headers: { "Content-Type": "application/json", "X-Editor-Id": editorId },
        body: JSON.stringify({ baseRev: revs.current, spec: latest }),
      }).catch(() => {});
    };
  }, [projectId, editorId]);

  /** Saves now (after any save in flight); false when the latest draft didn't save. */
  const flush = useCallback(() => save(), [save]);

  /** The person chose not to use a kept draft. */
  const discardKept = useCallback(() => void dropDraft(projectId), [projectId]);

  return { status, error, rev, dirty, savedSpec, reset, flush, setStatus, discardKept };
}
