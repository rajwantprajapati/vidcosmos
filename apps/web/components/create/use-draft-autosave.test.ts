// F22: what the save status line says.
import { describe, expect, it } from "vitest";
import { exampleScenes } from "@vidcosmos/spec/video";
import { testSpec } from "@vidcosmos/spec/video/testing";
import { autosaveLabel, sameDraft } from "./use-draft-autosave";

describe("the save status", () => {
  it("says saving while there are changes, and offline when they're kept locally", () => {
    expect(autosaveLabel("idle", false)).toBe("Saved");
    expect(autosaveLabel("idle", true)).toBe("Saving…");
    expect(autosaveLabel("saving", false)).toBe("Saving…");
    expect(autosaveLabel("saved", false)).toBe("Saved just now");
    expect(autosaveLabel("offline", true)).toBe("Offline – changes kept locally");
    expect(autosaveLabel("failed", true)).toBe("Not saved");
  });
});

describe("an already saved draft", () => {
  it("is the same draft whatever timing or userEdited the server added", () => {
    const mine = testSpec([exampleScenes.title, exampleScenes.recap]);
    const saved = testSpec([exampleScenes.title, exampleScenes.recap], { timed: true });
    saved.scenes[0]!.userEdited = true;
    expect(sameDraft(mine, saved)).toBe(true);
    const changed = structuredClone(mine);
    changed.scenes[1]!.narration = `${changed.scenes[1]!.narration} More.`;
    expect(sameDraft(changed, saved)).toBe(false);
    expect(sameDraft(null, null)).toBe(true);
    expect(sameDraft(mine, null)).toBe(false);
  });
});
