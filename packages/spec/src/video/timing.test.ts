// F18: when each element appears, from the recording's words or, before one exists, from words
// spaced at the speaking rate; triggers not found placed between their neighbours; lists kept
// in order.
import { describe, expect, it } from "vitest";
import { exampleScenes } from "./examples.ts";
import { scene as sceneSchema } from "./schema.ts";
import { testSpec } from "./testing.ts";
import { elementTimes, listStepMs, sceneLeadInMs, sceneWords } from "./timing.ts";

const bullets = sceneSchema.parse(exampleScenes.bullets);
// "You need three things: a bank account, a phone number, and a UPI app."

describe("sceneWords", () => {
  it("spaces words at the speaking rate before narration is recorded", () => {
    const words = sceneWords(bullets, "en");
    expect(words[0]).toEqual({ text: "You", startMs: 0, endMs: 400 });
    expect(words[1]?.startMs).toBe(400);
    expect(sceneWords(bullets, "hi")[1]?.startMs).toBe(Math.round(1000 / 2.2));
    expect(sceneWords(bullets, "en", 1.25)[1]?.startMs).toBe(320);
  });

  it("uses the recording's words once it exists", () => {
    const timed = testSpec([exampleScenes.title, exampleScenes.recap], { timed: true }).scenes[0]!;
    expect(sceneWords(timed, "en")).toBe(timed.timing!.words);
    expect(sceneLeadInMs(timed)).toBe(timed.timing!.leadInMs);
  });
});

describe("elementTimes", () => {
  it("shows each element as its trigger's first word starts, after the lead-in", () => {
    const times = elementTimes(bullets, "en");
    // "bank account" is the 6th word: 5 × 400 ms after the 300 ms lead-in.
    expect(times["items[0].trigger"]).toBe(300 + 5 * 400);
    expect(times["items[1].trigger"]).toBe(300 + 8 * 400);
    expect(times["items[2].trigger"]).toBe(300 + 12 * 400);
  });

  it("places a trigger that isn't said between its neighbours", () => {
    const missing = sceneSchema.parse({
      ...exampleScenes.bullets,
      content: {
        ...exampleScenes.bullets.content,
        items: exampleScenes.bullets.content.items.map((item, i) =>
          i === 1 ? { ...item, trigger: "never said" } : item,
        ),
      },
    });
    const times = elementTimes(missing, "en");
    expect(times["items[1].trigger"]).toBe(
      (times["items[0].trigger"]! + times["items[2].trigger"]!) / 2,
    );
  });

  it("never shows a list's item before the one above it", () => {
    const backwards = sceneSchema.parse({
      ...exampleScenes.bullets,
      content: {
        ...exampleScenes.bullets.content,
        items: [
          { text: "A UPI app", trigger: "UPI app" },
          { text: "A bank account", trigger: "bank account" },
        ],
      },
    });
    const times = elementTimes(backwards, "en");
    expect(times["items[1].trigger"]).toBe(times["items[0].trigger"]! + listStepMs);
  });

  it("gives every trigger of every template a time", () => {
    for (const example of Object.values(exampleScenes)) {
      const scene = sceneSchema.parse(example);
      const times = elementTimes(scene, "en");
      for (const value of Object.values(times)) expect(Number.isFinite(value)).toBe(true);
    }
  });
});
