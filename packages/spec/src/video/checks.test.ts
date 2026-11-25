// F16: the rules zod can't check (DB §6), the two hashes, and reading the prototype's specs.
import { describe, expect, it } from "vitest";
import {
  reconcileTiming,
  reuseRecordings,
  type SpecIssue,
  specIssues as allIssues,
  totalDurationMs,
} from "./checks.ts";
import { exampleScenes } from "./examples.ts";
import { canonicalJson, narrationHash, specHash } from "./hash.ts";
import { migrateSpec } from "./migrate.ts";
import { videoSpec } from "./schema.ts";
import { testSpec, testVoice } from "./testing.ts";
// The prototype's samples, copied as they were.
import photosynthesis from "./fixtures/photosynthesis.json" with { type: "json" };
import sampleVideo from "./fixtures/sample-video.json" with { type: "json" };
import upiHindi from "./fixtures/upi-hindi.json" with { type: "json" };

const fixtures: Record<string, unknown> = {
  "sample-video": sampleVideo,
  photosynthesis,
  "upi-hindi": upiHindi,
};
/**
 * The rules, without the length estimate for specs not yet recorded: the samples here are
 * deliberately short (a few scenes), so they'd all be "under 20 s". That rule has its own test.
 */
const specIssues = (...args: Parameters<typeof allIssues>): SpecIssue[] =>
  allIssues(...args).filter(
    (issue) => issue.code !== "DURATION_OUT_OF_RANGE" || totalDurationMs(args[0]) !== null,
  );

/** A fresh copy, so no test changes another's sample. */
const fixture = (name: string) => JSON.parse(JSON.stringify(fixtures[name])) as unknown;
const codes = (issues: { code: string }[]) => issues.map((issue) => issue.code);

describe("the VideoSpec schema", () => {
  it("needs 2-10 scenes, a known format and the V1 voice model", () => {
    const base = testSpec();
    expect(videoSpec.safeParse({ ...base, scenes: base.scenes.slice(0, 1) }).success).toBe(false);
    const eleven = Array.from({ length: 11 }, (_, i) => ({ ...base.scenes[0]!, id: `sc_${i}` }));
    expect(videoSpec.safeParse({ ...base, scenes: eleven }).success).toBe(false);
    expect(videoSpec.safeParse({ ...base, format: "4:3" }).success).toBe(false);
    expect(
      videoSpec.safeParse({ ...base, voice: { ...testVoice, model: "eleven_v3" } }).success,
    ).toBe(false);
    expect(videoSpec.safeParse({ ...base, voice: { ...testVoice, speed: 1.3 } }).success).toBe(
      false,
    );
    expect(base.music).toBeNull();
  });

  it("refuses timing that doesn't add up: too short a scene, or words out of order", () => {
    const base = testSpec([exampleScenes.title, exampleScenes.recap], { timed: true });
    const timing = base.scenes[0]!.timing!;
    const withTiming = (t: object) => ({
      ...base,
      scenes: [{ ...base.scenes[0]!, timing: { ...timing, ...t } }, base.scenes[1]],
    });
    expect(videoSpec.safeParse(withTiming({ durationMs: 1 })).success).toBe(false);
    expect(
      videoSpec.safeParse(withTiming({ words: [{ text: "a", startMs: 500, endMs: 100 }] })).success,
    ).toBe(false);
    expect(
      videoSpec.safeParse(
        withTiming({
          words: [
            { text: "a", startMs: 500, endMs: 600 },
            { text: "b", startMs: 100, endMs: 200 },
          ],
        }),
      ).success,
    ).toBe(false);
    expect(videoSpec.safeParse(withTiming({})).success).toBe(true);
  });

  it("refuses narration over 400 characters and timing that holds a URL", () => {
    const base = testSpec([exampleScenes.title, exampleScenes.recap], { timed: true });
    const tooLong = { ...base.scenes[0]!, narration: "word ".repeat(81) };
    expect(videoSpec.safeParse({ ...base, scenes: [tooLong, base.scenes[1]] }).success).toBe(false);
    const url = {
      ...base.scenes[0]!,
      timing: { ...base.scenes[0]!.timing!, narrationAssetId: "https://r2.example/a.mp3" },
    };
    expect(videoSpec.safeParse({ ...base, scenes: [url, base.scenes[1]] }).success).toBe(false);
  });
});

describe("rules checked on every write", () => {
  it("passes a spec whose triggers are all spoken, in order", () => {
    const all = Object.values(exampleScenes).slice(0, 10);
    expect(specIssues(testSpec(all))).toEqual([]);
  });

  it("finds a trigger that isn't in the narration, and one said out of order", () => {
    const spec = testSpec();
    const scene = spec.scenes[1]!;
    if (scene.template !== "flowchart") throw new Error("expected the flowchart");
    scene.content.steps[1]!.trigger = "the cloud";
    expect(specIssues(spec)).toEqual([
      expect.objectContaining({
        code: "TRIGGER_NOT_IN_NARRATION",
        sceneId: "sc_flow0001",
        path: "steps[1].trigger",
      }),
    ]);

    scene.content.steps[1]!.trigger = "to NPCI";
    scene.content.steps[0]!.trigger = "their bank"; // said last, shown first
    // Step 2 ("to NPCI") is said before step 1's words now.
    expect(specIssues(spec)).toEqual([
      expect.objectContaining({ code: "TRIGGER_OUT_OF_ORDER", path: "steps[1].trigger" }),
    ]);
  });

  it("matches triggers in Hindi, ignoring case and punctuation", () => {
    const hindi = testSpec([
      {
        ...exampleScenes.title,
        narration: "आप Pay दबाते हैं, और दो सेकंड में पैसा पहुँच जाता है।",
        content: {
          heading: "UPI कैसे काम करता है",
          headingTrigger: "आप pay",
          subheading: "दो सेकंड में",
          subheadingTrigger: "पैसा पहुँच",
        },
      },
      exampleScenes.recap,
    ]);
    expect(specIssues(hindi)).toEqual([]);
  });

  it("matches across curly and straight apostrophes, and across hyphens", () => {
    const spec = testSpec([
      {
        ...exampleScenes.title,
        narration: "It’s how money moves, step-by-step.",
        content: {
          heading: "Money, step by step",
          headingTrigger: "It's how",
          subheading: "Step by step",
          subheadingTrigger: "step by step",
        },
      },
      exampleScenes.recap,
    ]);
    expect(specIssues(spec)).toEqual([]);
  });

  it("lets titles be said anywhere, but keeps each list in spoken order", () => {
    // "Cash versus UPI" names both sides first: fine.
    const comparison = {
      ...exampleScenes.comparison,
      narration:
        "Cash versus UPI. Cash needs change and a trip to the ATM. UPI needs only your phone and a PIN.",
    };
    expect(specIssues(testSpec([comparison, exampleScenes.recap]))).toEqual([]);
    // A side's points in the wrong order are still caught.
    const swapped = JSON.parse(JSON.stringify(comparison)) as typeof comparison;
    swapped.content.right.points.reverse();
    expect(specIssues(testSpec([swapped, exampleScenes.recap]))).toEqual([
      expect.objectContaining({ code: "TRIGGER_OUT_OF_ORDER", path: "right.points[1].trigger" }),
    ]);
  });

  it("needs a quiz's answer and a recap's call to action after the list they close", () => {
    expect(specIssues(testSpec([exampleScenes.quiz, exampleScenes.recap]))).toEqual([]);
    const early = JSON.parse(JSON.stringify(exampleScenes.quiz)) as typeof exampleScenes.quiz;
    early.content.reveal.trigger = "Your bank"; // the first option's words
    expect(specIssues(testSpec([early, exampleScenes.recap]))).toEqual([
      expect.objectContaining({ code: "TRIGGER_OUT_OF_ORDER", path: "reveal.trigger" }),
    ]);
    // At the same moment as the last option is too soon.
    early.content.reveal.trigger = "or nobody";
    expect(specIssues(testSpec([early, exampleScenes.recap]))).toHaveLength(1);

    const cta = JSON.parse(JSON.stringify(exampleScenes.recap)) as typeof exampleScenes.recap;
    cta.content.ctaTrigger = "So remember";
    expect(specIssues(testSpec([exampleScenes.title, cta]))).toEqual([
      expect.objectContaining({ code: "TRIGGER_OUT_OF_ORDER", path: "ctaTrigger" }),
    ]);
  });

  it("finds duplicate scene ids", () => {
    const spec = testSpec([exampleScenes.title, exampleScenes.title]);
    expect(codes(specIssues(spec))).toEqual(["DUPLICATE_SCENE_ID"]);
  });

  it("checks the total length (20-100 s) only once every scene has timing", () => {
    expect(totalDurationMs(testSpec())).toBeNull();
    const short = testSpec(undefined, { timed: true, durationMs: 5000 }); // 15 s
    expect(totalDurationMs(short)).toBe(15_000);
    expect(codes(specIssues(short))).toEqual(["DURATION_OUT_OF_RANGE"]);
    expect(specIssues(testSpec(undefined, { timed: true, durationMs: 10_000 }))).toEqual([]);
    expect(codes(specIssues(testSpec(undefined, { timed: true, durationMs: 34_000 })))).toEqual([
      "DURATION_OUT_OF_RANGE",
    ]);
  });

  it("before recording, estimates the length from the words, with a 10 s margin over 100 s", () => {
    const words = (n: number) => Array.from({ length: n }, () => "word").join(" ");
    const scene = (id: string, n: number) => ({
      ...exampleScenes.title,
      id,
      narration: `You tap Pay ${words(n)} follow it.`,
    });
    // 10 scenes of 30 words: 12 s each at 2.5 words a second, plus 0.7 s: 127 s.
    const long = testSpec(Array.from({ length: 10 }, (_, i) => scene(`sc_${i}`, 25)));
    expect(allIssues(long)).toEqual([
      {
        code: "DURATION_OUT_OF_RANGE",
        sceneId: null,
        message: "About 127 s of narration: a video can be at most 100 s. Shorten some scenes.",
      },
    ]);
    // 8 of them: 102 s, inside the margin.
    expect(allIssues(testSpec(long.scenes.slice(0, 8)))).toEqual([]);
    expect(codes(allIssues(testSpec([exampleScenes.title, exampleScenes.recap])))).toEqual([
      "DURATION_OUT_OF_RANGE",
    ]);
    expect(allIssues(testSpec([exampleScenes.title, exampleScenes.recap]))[0]?.message).toContain(
      "needs at least 20 s",
    );
  });

  it("on generation, checks the narration reproduces the script (95% of it, 5% extra at most)", () => {
    const spec = testSpec();
    const script = spec.scenes.map((s) => s.narration).join(" ");
    expect(specIssues(spec, { script })).toEqual([]);
    // One extra word in 47 is under 5%.
    expect(
      specIssues(spec, { script: script.replace("Let's follow it.", "Let's follow it now.") }),
    ).toEqual([]);
    const dropped = specIssues(spec, {
      script: `${script} ${"And then much more happens here.".repeat(3)}`,
    });
    expect(codes(dropped)).toEqual(["NARRATION_MISMATCH"]);
    expect(dropped[0]?.message).toContain("covers");
  });
});

describe("hashes", () => {
  it("narrationHash follows the words, language and voice, not the format", () => {
    const base = narrationHash("Hello there.", "en", testVoice);
    expect(base).toMatch(/^[0-9a-f]{64}$/);
    expect(narrationHash("Hello there.", "en", testVoice)).toBe(base);
    expect(narrationHash("Hello there!", "en", testVoice)).not.toBe(base);
    expect(narrationHash("Hello there.", "hi", testVoice)).not.toBe(base);
    expect(narrationHash("Hello there.", "en", { ...testVoice, speed: 1.1 })).not.toBe(base);
    expect(narrationHash("Hello there.", "en", { ...testVoice, voiceId: "other" })).not.toBe(base);
  });

  it("specHash ignores key order and changes with anything on screen", () => {
    const spec = testSpec();
    const reordered = JSON.parse(canonicalJson(spec)) as typeof spec;
    expect(Object.keys(reordered)[0]).toBe("format");
    expect(specHash(reordered)).toBe(specHash(spec));
    expect(specHash({ ...spec, format: "16:9" })).not.toBe(specHash(spec));
    expect(specHash({ ...spec, theme: { ...spec.theme, palette: "sunset" } })).not.toBe(
      specHash(spec),
    );
    // Marking a scene as hand-edited changes no frame, so the export can be reused.
    const marked = { ...spec, scenes: spec.scenes.map((s) => ({ ...s, userEdited: true })) };
    expect(specHash(marked)).toBe(specHash(spec));
    // A known value, so the browser and the server agree on the algorithm.
    expect(canonicalJson({ b: 1, a: [{ d: 2, c: 3 }] })).toBe('{"a":[{"c":3,"d":2}],"b":1}');
  });

  it("reconcileTiming keeps audio that still matches and clears the rest", () => {
    const spec = testSpec(undefined, { timed: true });
    expect(reconcileTiming(spec).cleared).toEqual([]);
    const changed = {
      ...spec,
      scenes: spec.scenes.map((s, i) =>
        i === 1 ? { ...s, narration: `${s.narration} Done.` } : s,
      ),
    };
    const { spec: after, cleared } = reconcileTiming(changed);
    expect(cleared).toEqual(["sc_flow0001"]);
    expect(after.scenes.map((s) => s.timing === null)).toEqual([false, true, false]);
  });

  it("reuseRecordings gives a scene without timing the recording of the same words", () => {
    const spec = testSpec(undefined, { timed: true });
    const [first, second] = spec.scenes;
    const copy = { ...first!, id: "sc_copy0001", timing: null };
    const other = {
      ...second!,
      id: "sc_other001",
      narration: "Words nobody recorded.",
      timing: null,
    };
    const after = reuseRecordings({ ...spec, scenes: [...spec.scenes, copy, other] });
    expect(after.scenes[3]!.timing).toEqual(first!.timing);
    expect(after.scenes[4]!.timing).toBeNull();
    // Another voice: the recording doesn't fit.
    const male = { ...spec.voice, gender: "male" as const, voiceId: "another-voice" };
    const voiced = reuseRecordings({ ...spec, voice: male, scenes: [copy] }, [spec]);
    expect(voiced.scenes[0]!.timing).toBeNull();
    // From the stored draft (the server) too; nothing to reuse gives the same spec back.
    const alone = { ...spec, scenes: [copy] };
    expect(reuseRecordings(alone, [spec]).scenes[0]!.timing).toEqual(first!.timing);
    const untimed = testSpec();
    expect(reuseRecordings(untimed)).toBe(untimed);
  });
});

describe("migrateSpec", () => {
  const defaults = { language: "en" as const, voice: testVoice };

  it("reads the prototype's sample video: 9:16, its audio paths dropped, and valid", () => {
    const spec = migrateSpec(fixture("sample-video"), defaults);
    expect(spec.format).toBe("9:16");
    expect(spec.voice).toEqual(testVoice);
    expect(spec.music).toBeNull();
    expect(spec.scenes).toHaveLength(6);
    expect(spec.scenes.every((s) => s.timing === null && s.userEdited === false)).toBe(true);
    expect(specIssues(spec)).toEqual([]);
  });

  it("reads the prototype's storyboards, English and Hindi, and they validate", () => {
    const english = migrateSpec(fixture("photosynthesis"), defaults);
    expect(english.theme).toEqual({ palette: "ocean", captionStyle: "highlight" });
    expect(english.title).toBe("How plants make food from light");
    expect(specIssues(english)).toEqual([]);

    const hindi = migrateSpec(fixture("upi-hindi"), { ...defaults, language: "hi" });
    expect(hindi.language).toBe("hi");
    expect(hindi.scenes.map((s) => s.template)).toEqual([
      "title",
      "flowchart",
      "comparison",
      "bullets",
    ]);
    expect(specIssues(hindi)).toEqual([]);
  });

  it("keeps today's specs as they are, timing included", () => {
    const spec = testSpec(undefined, { timed: true });
    expect(migrateSpec(JSON.parse(JSON.stringify(spec)))).toEqual(spec);
  });

  it("refuses a spec version it doesn't know", () => {
    expect(() => migrateSpec({ ...testSpec(), version: 2 })).toThrow(
      "Video spec version 2 isn't supported.",
    );
  });

  it("says what's missing instead of guessing a voice or language", () => {
    expect(() => migrateSpec(fixture("photosynthesis"))).toThrow("no language");
    expect(() => migrateSpec(fixture("photosynthesis"), { language: "en" })).toThrow("no voice");
    expect(() => migrateSpec("nope")).toThrow("must be an object");
  });
});
