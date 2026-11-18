// F16: the typed revision operations (SDD §10): every one, what it changes, which scenes need
// new audio, and the refusals. `setFormat` keeps every recording.
import { describe, expect, it } from "vitest";
import { exampleScenes } from "./examples.ts";
import { narrationHash } from "./hash.ts";
import { applyOperations, newSceneId, SpecOperationError, specOperation } from "./operations.ts";
import { testSpec } from "./testing.ts";

const timed = () => testSpec(undefined, { timed: true });
const ids = (spec: { scenes: { id: string }[] }) => spec.scenes.map((s) => s.id);
const fixedId = () => "sc_new00001";

describe("applyOperations", () => {
  it("setFormat changes only the layout: every scene keeps its narrationHash and audio", () => {
    const spec = timed();
    const result = applyOperations(spec, [{ op: "setFormat", format: "16:9" }]);
    expect(result.spec.format).toBe("16:9");
    expect(result.spec.scenes.map((s) => s.timing)).toEqual(spec.scenes.map((s) => s.timing));
    for (const scene of result.spec.scenes) {
      expect(scene.timing?.narrationHash).toBe(
        narrationHash(scene.narration, result.spec.language, result.spec.voice),
      );
    }
    expect(result.needsNarration).toEqual([]);
    expect(result.affectedSceneIds).toEqual([]);
  });

  it("updateScene: new narration needs new audio; new content alone doesn't", () => {
    const spec = timed();
    const words = applyOperations(spec, [
      {
        op: "updateScene",
        sceneId: "sc_title001",
        narration: "You tap Pay, and two seconds later your friend has it. Let's follow it.",
      },
    ]);
    expect(words.affectedSceneIds).toEqual(["sc_title001"]);
    expect(words.needsNarration).toEqual(["sc_title001"]);
    expect(words.spec.scenes[0]!.timing).toBeNull();
    expect(words.spec.scenes[1]!.timing).not.toBeNull();

    const look = applyOperations(spec, [
      {
        op: "updateScene",
        sceneId: "sc_title001",
        content: { ...exampleScenes.title.content, heading: "UPI in two seconds" },
      },
    ]);
    expect(look.needsNarration).toEqual([]);
    expect(look.spec.scenes[0]!.timing).not.toBeNull();
    expect(look.spec.scenes[0]).toMatchObject({ content: { heading: "UPI in two seconds" } });
  });

  it("updateScene can change the template, with its content", () => {
    const spec = testSpec();
    const result = applyOperations(spec, [
      {
        op: "updateScene",
        sceneId: "sc_flow0001",
        template: "bullets",
        content: {
          heading: "Three hops",
          items: [
            { text: "Your app", trigger: "Your app" },
            { text: "NPCI", trigger: "to NPCI" },
          ],
        },
      },
    ]);
    expect(result.spec.scenes[1]!.template).toBe("bullets");
    expect(result.issues).toEqual([]);
    expect(() =>
      applyOperations(spec, [{ op: "updateScene", sceneId: "sc_flow0001", template: "quiz" }]),
    ).toThrow("needs its content");
    // Content that doesn't fit the template is refused, naming where.
    expect(() =>
      applyOperations(spec, [
        { op: "updateScene", sceneId: "sc_flow0001", content: { heading: "No steps" } },
      ]),
    ).toThrow(/isn't valid\. scenes\.1\.content/);
  });

  it("addScene puts a new scene first or after another, with a fresh id and no audio", () => {
    const spec = timed();
    const { id: _id, ...fresh } = exampleScenes.bullets;
    const after = applyOperations(
      spec,
      [{ op: "addScene", afterSceneId: "sc_flow0001", scene: fresh }],
      { newId: fixedId },
    );
    expect(ids(after.spec)).toEqual(["sc_title001", "sc_flow0001", "sc_new00001", "sc_recap001"]);
    expect(after.spec.scenes[2]).toMatchObject({ userEdited: false, timing: null });
    expect(after.needsNarration).toEqual(["sc_new00001"]);
    expect(after.affectedSceneIds).toEqual(["sc_new00001"]);

    const first = applyOperations(spec, [{ op: "addScene", afterSceneId: null, scene: fresh }], {
      newId: fixedId,
    });
    expect(ids(first.spec)[0]).toBe("sc_new00001");
    expect(() =>
      applyOperations(spec, [
        { op: "addScene", afterSceneId: null, scene: { ...fresh, id: "sc_title001" } },
      ]),
    ).toThrow('A scene "sc_title001" already exists.');
    expect(newSceneId()).toMatch(/^sc_[a-z0-9]{8}$/);
  });

  it("removeScene and moveScene keep every other scene's audio, and need 2 scenes left", () => {
    const spec = timed();
    const removed = applyOperations(spec, [{ op: "removeScene", sceneId: "sc_flow0001" }]);
    expect(ids(removed.spec)).toEqual(["sc_title001", "sc_recap001"]);
    expect(removed.needsNarration).toEqual([]);
    expect(() =>
      applyOperations(removed.spec, [{ op: "removeScene", sceneId: "sc_recap001" }]),
    ).toThrow(SpecOperationError);

    const moved = applyOperations(spec, [
      { op: "moveScene", sceneId: "sc_recap001", afterSceneId: null },
    ]);
    expect(ids(moved.spec)).toEqual(["sc_recap001", "sc_title001", "sc_flow0001"]);
    expect(moved.affectedSceneIds).toEqual(["sc_recap001"]);
    expect(moved.needsNarration).toEqual([]);
    const last = applyOperations(spec, [
      { op: "moveScene", sceneId: "sc_title001", afterSceneId: "sc_recap001" },
    ]);
    expect(ids(last.spec)).toEqual(["sc_flow0001", "sc_recap001", "sc_title001"]);
  });

  it("setTheme and setMusic change the look and sound, never the narration", () => {
    const spec = timed();
    const result = applyOperations(spec, [
      { op: "setTheme", palette: "sunset" },
      { op: "setMusic", music: { trackId: "calm-01", volume: 0.3, duck: true } },
    ]);
    expect(result.spec.theme).toEqual({ palette: "sunset", captionStyle: "highlight" });
    expect(result.spec.music).toEqual({ trackId: "calm-01", volume: 0.3, duck: true });
    expect(result.needsNarration).toEqual([]);
    expect(applyOperations(result.spec, [{ op: "setMusic", music: null }]).spec.music).toBeNull();
  });

  it("setVoice refuses a new narrator without its voice id", () => {
    expect(() => applyOperations(timed(), [{ op: "setVoice", gender: "male" }])).toThrow(
      "A new narrator needs its voice id.",
    );
    // The same gender again changes nothing and is fine.
    expect(applyOperations(timed(), [{ op: "setVoice", gender: "female" }]).needsNarration).toEqual(
      [],
    );
  });

  it("setVoice needs new audio for every scene", () => {
    const result = applyOperations(timed(), [{ op: "setVoice", gender: "male", voiceId: "v_m" }]);
    expect(result.spec.voice).toMatchObject({ gender: "male", voiceId: "v_m", speed: 1 });
    expect(result.needsNarration).toEqual(["sc_title001", "sc_flow0001", "sc_recap001"]);
    expect(result.spec.scenes.every((s) => s.timing === null)).toBe(true);
    // Only the speed: still every scene.
    expect(applyOperations(timed(), [{ op: "setVoice", speed: 1.1 }]).needsNarration).toHaveLength(
      3,
    );
  });

  it("rewriteAll names every scene once, and re-records only the ones whose words changed", () => {
    const spec = timed();
    const same = (id: string) => spec.scenes.find((s) => s.id === id)!.narration;
    const result = applyOperations(spec, [
      {
        op: "rewriteAll",
        scenes: [
          { sceneId: "sc_title001", narration: same("sc_title001") },
          {
            sceneId: "sc_flow0001",
            narration: "Your app asks NPCI, NPCI asks their bank, and their bank says yes to NPCI.",
          },
          { sceneId: "sc_recap001", narration: same("sc_recap001") },
        ],
      },
    ]);
    expect(result.affectedSceneIds).toEqual(["sc_title001", "sc_flow0001", "sc_recap001"]);
    expect(result.needsNarration).toEqual(["sc_flow0001"]);
    expect(() =>
      applyOperations(spec, [
        { op: "rewriteAll", scenes: [{ sceneId: "sc_title001", narration: "Only one." }] },
      ]),
    ).toThrow("must name each scene once");
  });

  it("refuses an unknown scene and leaves the original spec untouched", () => {
    const spec = timed();
    const before = JSON.stringify(spec);
    expect(() =>
      applyOperations(spec, [
        { op: "setTheme", palette: "paper" },
        { op: "removeScene", sceneId: "sc_missing" },
      ]),
    ).toThrow('There\'s no scene "sc_missing".');
    try {
      applyOperations(spec, [{ op: "moveScene", sceneId: "sc_title001", afterSceneId: "sc_x" }]);
    } catch (error) {
      expect((error as SpecOperationError).operationIndex).toBe(0);
    }
    expect(JSON.stringify(spec)).toBe(before);
  });

  it("reports the semantic rules on the result without refusing it", () => {
    const result = applyOperations(testSpec(), [
      { op: "updateScene", sceneId: "sc_title001", narration: "Something else entirely here." },
    ]);
    // The sample is short, so it's also under 20 s by its words.
    expect(result.issues.map((i) => i.code)).toEqual([
      "TRIGGER_NOT_IN_NARRATION",
      "TRIGGER_NOT_IN_NARRATION",
      "DURATION_OUT_OF_RANGE",
    ]);
  });

  it("the operation schema takes only the nine operations", () => {
    expect(specOperation.safeParse({ op: "setFormat", format: "1:1" }).success).toBe(true);
    expect(specOperation.safeParse({ op: "deleteEverything" }).success).toBe(false);
    expect(specOperation.safeParse({ op: "setFormat", format: "4:3" }).success).toBe(false);
    // Fields it doesn't know are refused, not dropped: they come from the LLM.
    expect(
      specOperation.safeParse({ op: "setTheme", palette: "paper", font: "Comic" }).success,
    ).toBe(false);
    expect(
      specOperation.safeParse({
        op: "rewriteAll",
        scenes: [{ sceneId: "sc_a", narration: "Hi.", mood: "sad" }],
      }).success,
    ).toBe(false);
    expect(specOperation.options.map((o) => o.shape.op.value)).toEqual([
      "updateScene",
      "addScene",
      "removeScene",
      "moveScene",
      "setFormat",
      "setTheme",
      "setVoice",
      "setMusic",
      "rewriteAll",
    ]);
  });
});
