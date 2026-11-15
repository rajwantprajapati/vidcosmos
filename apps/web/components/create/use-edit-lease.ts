"use client";

// The edit lease for a project (API §5 "Edit lease"): only one tab changes a video at a time.
// The tab's editor id lives in sessionStorage, so a reload keeps the lease. Taken on open,
// renewed every 30 s (it lasts 60), given up with a beacon when the tab closes. Held elsewhere:
// the page goes read-only and offers "Edit here instead".
import { useCallback, useEffect, useState } from "react";
import { apiFetch, ApiRequestError } from "@/lib/api-client";

const storageKey = "vidcosmos.editorId";
export const leaseRenewMs = 30_000;

/** This tab's editor id: the same across reloads of the tab, different in another tab. */
export function getEditorId(): string {
  try {
    const stored = sessionStorage.getItem(storageKey);
    if (stored) return stored;
    const id = crypto.randomUUID();
    sessionStorage.setItem(storageKey, id);
    return id;
  } catch {
    // Storage blocked: one id per page load still works, it just doesn't survive a reload.
    const holder = globalThis as typeof globalThis & { __vidcosmosEditorId?: string };
    holder.__vidcosmosEditorId ??= crypto.randomUUID();
    return holder.__vidcosmosEditorId;
  }
}

export type LeaseState =
  | { status: "taking" }
  | { status: "held" }
  | { status: "elsewhere"; byYou: boolean }
  | { status: "error"; message: string };

export function useEditLease(projectId: string | null) {
  const [state, setState] = useState<LeaseState>({ status: projectId ? "taking" : "held" });
  const [editorId] = useState(() => (typeof window === "undefined" ? "" : getEditorId()));

  const take = useCallback(
    async (takeover = false) => {
      if (!projectId) return;
      try {
        await apiFetch(`/projects/${projectId}/lease`, {
          method: "POST",
          body: takeover ? { takeover: true } : {},
          editorId: getEditorId(),
        });
        setState({ status: "held" });
      } catch (error) {
        if (error instanceof ApiRequestError && error.code === "LEASE_HELD") {
          setState({ status: "elsewhere", byYou: error.details?.heldBy === "you_elsewhere" });
        } else {
          setState({
            status: "error",
            message:
              error instanceof Error ? error.message : "Couldn't open this video for editing.",
          });
        }
      }
    },
    [projectId],
  );

  useEffect(() => {
    if (!projectId) return;
    // Taken right after mounting, then renewed while the tab is visible.
    const first = setTimeout(() => void take(), 0);
    const timer = setInterval(() => {
      if (!document.hidden) void take();
    }, leaseRenewMs);
    const release = () => {
      const body = new Blob([JSON.stringify({ editorId: getEditorId() })], {
        type: "application/json",
      });
      navigator.sendBeacon?.(`/api/v1/projects/${projectId}/lease/release`, body);
    };
    window.addEventListener("pagehide", release);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      window.removeEventListener("pagehide", release);
    };
  }, [projectId, take]);

  return { state, editorId, takeover: () => take(true) };
}
