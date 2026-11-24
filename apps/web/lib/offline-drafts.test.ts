// F22: unsaved edits kept in the browser (in memory here, where there's no IndexedDB): a draft
// with the rev it was based on, settings merged so the latest of each wins, and each dropped
// on its own once saved.
import { exampleScenes } from "@vidcosmos/spec/video";
import { testSpec } from "@vidcosmos/spec/video/testing";
import { describe, expect, it } from "vitest";
import {
  dropDraft,
  dropSettings,
  isOffline,
  keepDraft,
  keepSettings,
  mergeSettings,
  readPending,
} from "./offline-drafts";

describe("edits kept offline", () => {
  it("keeps the latest draft with its rev, and settings with the latest of each", async () => {
    const id = "6730a1b2c3d4e5f6a7b8c9d0";
    const spec = testSpec([exampleScenes.title, exampleScenes.recap]);
    expect(await readPending(id)).toBeNull();

    await keepDraft(id, 3, spec, "tab-1");
    await keepSettings(id, { palette: "paper", format: "16:9" }, "tab-1");
    await keepSettings(id, { format: "1:1" }, "tab-1");
    const kept = await readPending(id);
    expect(kept?.draft).toMatchObject({ baseRev: 3, spec, editorId: "tab-1" });
    expect(kept?.settings?.patch).toEqual({ palette: "paper", format: "1:1" });

    // Another tab's settings start afresh rather than merging into this tab's.
    await keepSettings(id, { captionStyle: "none" }, "tab-2");
    expect((await readPending(id))?.settings).toMatchObject({
      patch: { captionStyle: "none" },
      editorId: "tab-2",
    });

    await dropDraft(id);
    expect((await readPending(id))?.draft).toBeUndefined();
    expect((await readPending(id))?.settings).toBeDefined();
    await dropSettings(id);
    expect(await readPending(id)).toBeNull();
  });

  it("merges settings so the later value wins", () => {
    expect(mergeSettings({ palette: "ocean", captionStyle: "none" }, { palette: "paper" })).toEqual(
      {
        palette: "paper",
        captionStyle: "none",
      },
    );
    expect(mergeSettings(undefined, { format: "9:16" })).toEqual({ format: "9:16" });
  });

  it("counts a request that never reached the server as offline", () => {
    expect(isOffline(new TypeError("Failed to fetch"))).toBe(true);
    expect(isOffline(new Error("Server said no"))).toBe(false);
  });
});
