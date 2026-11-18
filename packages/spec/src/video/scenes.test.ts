// F17: the storyboard's view of a scene: highlighted trigger words, element labels, length
// estimates, switching template by hand, and the edit panel's fields.
import { describe, expect, it } from "vitest";
import { specIssues } from "./checks.ts";
import { exampleScenes } from "./examples.ts";
import { sceneForm } from "./form.ts";
import {
  addedTexts,
  clipText,
  convertScene,
  estimatedSceneMs,
  estimatedVideoMs,
  narrationKeywords,
  sceneElements,
  sceneHeadline,
  sceneTexts,
  templateLabels,
  valueAt,
  withValueAt,
} from "./scenes.ts";
import { type Scene, scene as sceneSchema } from "./schema.ts";
import { templateNames } from "./templates.ts";
import { testSpec } from "./testing.ts";
import { triggerRanges } from "./text.ts";

const examples = templateNames.map((name) => sceneSchema.parse(exampleScenes[name]));

describe("trigger words in the narration", () => {
  it("finds each trigger's characters, leaving punctuation out", () => {
    const narration = "You tap “Pay”, and in two seconds your friend has the money.";
    const [pay, money, missing] = triggerRanges(narration, ["pay", "the money", "secure"]);
    expect(narration.slice(pay!.start, pay!.end)).toBe("Pay");
    expect(narration.slice(money!.start, money!.end)).toBe("the money");
    expect(missing).toBeNull();
  });

  it("matches across hyphens and apostrophes as the checks do", () => {
    const narration = "It's a step-by-step process.";
    const [range] = triggerRanges(narration, ["by step"]);
    expect(narration.slice(range!.start, range!.end)).toBe("by-step");
  });
});

describe("what a scene shows", () => {
  it("names every template and finds each scene's headline", () => {
    expect(Object.keys(templateLabels)).toEqual(templateNames);
    expect(sceneHeadline(examples[0]!)).toBe("How UPI moves your money");
    expect(sceneHeadline(sceneSchema.parse(exampleScenes.statCallout))).toBe("10 billion");
  });

  it("lists each element with its text and words, in on-screen order", () => {
    expect(sceneElements(sceneSchema.parse(exampleScenes.bullets))).toEqual([
      { path: "items[0].trigger", label: "A bank account", trigger: "bank account" },
      { path: "items[1].trigger", label: "A phone number", trigger: "phone number" },
      { path: "items[2].trigger", label: "A UPI app", trigger: "UPI app" },
    ]);
    const quiz = sceneElements(sceneSchema.parse(exampleScenes.quiz));
    expect(quiz.at(0)).toMatchObject({ label: "Who sees your UPI PIN?" });
    expect(quiz.at(-1)).toEqual({
      path: "reveal.trigger",
      label: "Answer “Nobody”",
      trigger: "The answer",
    });
    expect(sceneElements(sceneSchema.parse(exampleScenes.comparison))[0]).toMatchObject({
      path: "left.titleTrigger",
      label: "Cash",
    });
  });

  it("estimates a scene's length from its words until it's recorded", () => {
    const title = examples[0]!; // 15 words
    expect(estimatedSceneMs(title, "en")).toBe(6000 + 700);
    expect(estimatedSceneMs(title, "en", 1.15)).toBe(Math.round(6000 / 1.15) + 700);
    const timed = testSpec([exampleScenes.title, exampleScenes.recap], { timed: true });
    expect(estimatedSceneMs(timed.scenes[0]!, "en")).toBe(8000);
    // The video's figure is the scenes' added before rounding, as the footer and rule show it.
    expect(estimatedVideoMs(timed)).toBe(16_000);
  });
});

describe("text people read", () => {
  it("lists every on-screen text, including a quiz's question and a timeline's dates", () => {
    expect(sceneTexts(sceneSchema.parse(exampleScenes.quiz))).toEqual([
      "Who sees your UPI PIN?",
      "Your bank",
      "The shop",
      "Nobody",
    ]);
    expect(sceneTexts(sceneSchema.parse(exampleScenes.timeline))).toContain("2016");
    // Trigger words are narration, icons aren't text.
    expect(sceneTexts(sceneSchema.parse(exampleScenes.bullets))).not.toContain("bank account");
    expect(sceneTexts(sceneSchema.parse(exampleScenes.bullets))).not.toContain("Building2");
  });

  it("finds only what an edit adds: changed narration and new on-screen text", () => {
    const before = testSpec([exampleScenes.title, exampleScenes.recap]);
    expect(addedTexts(before, before)).toEqual({ narration: [], onScreen: [] });
    const after = JSON.parse(JSON.stringify(before)) as typeof before;
    after.scenes[1]!.narration = `${after.scenes[1]!.narration} One more line.`;
    (after.scenes[0]!.content as { heading: string }).heading = "A new heading";
    expect(addedTexts(before, after)).toEqual({
      narration: [after.scenes[1]!.narration],
      onScreen: ["A new heading"],
    });
    expect(addedTexts(null, before).narration).toHaveLength(2);
  });
});

describe("paths", () => {
  it("reads and writes a field without changing the original", () => {
    const content = exampleScenes.comparison.content;
    expect(valueAt(content, "left.points[1].trigger")).toBe("the ATM");
    const changed = withValueAt(content, "left.points[1].trigger", "ATM");
    expect(valueAt(changed, "left.points[1].trigger")).toBe("ATM");
    expect(valueAt(content, "left.points[1].trigger")).toBe("the ATM");
    const cleared = withValueAt(exampleScenes.title.content, "subheading", undefined);
    expect("subheading" in cleared).toBe(false);
  });
});

describe("switching template by hand", () => {
  it("turns every example into every template with no issues", () => {
    for (const from of examples) {
      for (const template of templateNames) {
        const converted = convertScene(from, template);
        const label = `${from.template} → ${template}`;
        expect(converted.template, label).toBe(template);
        expect(converted.narration, label).toBe(from.narration);
        expect(converted.id, label).toBe(from.id);
        const other = from.template === "recap" ? exampleScenes.title : exampleScenes.recap;
        const spec = testSpec([converted, other]);
        expect(
          specIssues(spec).filter((issue) => issue.sceneId === from.id),
          label,
        ).toEqual([]);
      }
    }
  });

  it("keeps the texts and triggers that fit", () => {
    const flow = convertScene(sceneSchema.parse(exampleScenes.bullets), "flowchart");
    expect(flow.content).toMatchObject({
      heading: "What you need",
      layout: "linear",
      steps: [
        { label: "A bank account", trigger: "bank account", icon: "Building2" },
        { label: "A phone number", trigger: "phone number", icon: "Phone" },
        { label: "A UPI app", trigger: "UPI app", icon: "Smartphone" },
      ],
    });
  });

  it("gives a chart the numbers its labels mention, or 1 each to set", () => {
    const bars = convertScene(sceneSchema.parse(exampleScenes.timeline), "barChart");
    expect(bars.content).toMatchObject({
      // "UPI launches", "1 billion a month", "10 billion a month".
      bars: [{ value: 1 }, { value: 1 }, { value: 10 }],
    });
    const stat = convertScene(sceneSchema.parse(exampleScenes.timeline), "statCallout");
    expect(stat.content).toMatchObject({ value: "2016", valueTrigger: "2016" });
  });

  it("fills missing elements with words the narrator says, in order", () => {
    const grid = convertScene(examples[0]!, "iconGrid");
    expect(grid.template === "iconGrid" && grid.content.items).toHaveLength(4);
  });

  it("finds keywords and clips text at a word", () => {
    expect(
      narrationKeywords("You tap Pay, and your friend has the money.", 2).map((k) => k.trigger),
    ).toEqual(["friend", "money"]);
    expect(clipText("Three hops in two seconds flat", 20)).toBe("Three hops in two…");
  });
});

describe("the edit panel", () => {
  it("describes fields that exist, for every template", () => {
    for (const scene of examples) {
      for (const group of sceneForm(scene)) {
        for (const field of group.fields) {
          if (field.kind === "text" && field.required) {
            expect(typeof valueAt(scene.content, field.path), field.path).toBe("string");
          }
          if (field.kind === "trigger" && field.required) {
            expect(typeof valueAt(scene.content, field.path), field.path).toBe("string");
          }
        }
      }
    }
  });

  it("an edit through a field path keeps the scene valid", () => {
    const quiz = sceneSchema.parse(exampleScenes.quiz) as Scene;
    const content = withValueAt(quiz.content, "options[0].text", "My bank");
    expect(sceneSchema.safeParse({ ...quiz, content }).success).toBe(true);
    const tooLong = withValueAt(quiz.content, "options[0].text", "x".repeat(61));
    expect(sceneSchema.safeParse({ ...quiz, content: tooLong }).success).toBe(false);
  });
});
