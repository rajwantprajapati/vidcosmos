// F16: the 12 template contracts (DB §6 "Templates"): a valid example of each, every limit,
// the closed icon list, and triggers read in on-screen order.
import { describe, expect, it } from "vitest";
import { exampleScenes } from "./examples.ts";
import { iconNames } from "./icons.ts";
import { scene } from "./schema.ts";
import { templateContent, templateNames, triggersOf } from "./templates.ts";

const long = (n: number) => "x".repeat(n);
const valid = (value: unknown) => scene.safeParse(value).success;

/** The example scene with its content changed by `edit`. */
function edited<T extends keyof typeof exampleScenes>(
  template: T,
  edit: (content: Record<string, any>) => void, // eslint-disable-line @typescript-eslint/no-explicit-any -- tests poke at any field
) {
  const copy = JSON.parse(JSON.stringify(exampleScenes[template]));
  edit(copy.content);
  return copy;
}

describe("templates", () => {
  it("has the 12 V1 templates, each with a valid example", () => {
    expect(templateNames).toEqual([
      "title",
      "bullets",
      "keyTerm",
      "flowchart",
      "comparison",
      "timeline",
      "barChart",
      "pieChart",
      "iconGrid",
      "statCallout",
      "quiz",
      "recap",
    ]);
    for (const name of templateNames) {
      const parsed = scene.safeParse(exampleScenes[name]);
      expect(parsed.success, name).toBe(true);
      expect(parsed.data).toMatchObject({ userEdited: false, timing: null });
    }
  });

  it("keeps every limit from DB §6", () => {
    const refused: [string, unknown][] = [
      ["title heading over 60", edited("title", (c) => (c.heading = long(61)))],
      ["title without its trigger", edited("title", (c) => delete c.headingTrigger)],
      ["bullets with 1 item", edited("bullets", (c) => (c.items = c.items.slice(0, 1)))],
      ["bullets with 6 items", edited("bullets", (c) => (c.items = [...c.items, ...c.items]))],
      ["bullet over 60", edited("bullets", (c) => (c.items[0].text = long(61)))],
      ["bullets without a heading", edited("bullets", (c) => delete c.heading)],
      ["key term over 40", edited("keyTerm", (c) => (c.term = long(41)))],
      ["definition over 140", edited("keyTerm", (c) => (c.definition = long(141)))],
      ["flowchart with 2 steps", edited("flowchart", (c) => (c.steps = c.steps.slice(0, 2)))],
      ["flowchart step over 28", edited("flowchart", (c) => (c.steps[0].label = long(29)))],
      ["flowchart layout", edited("flowchart", (c) => (c.layout = "tree"))],
      [
        "comparison side with 5 points",
        edited("comparison", (c) => {
          c.left.points = [...c.left.points, ...c.left.points, c.left.points[0]];
        }),
      ],
      ["comparison side with none", edited("comparison", (c) => (c.right.points = []))],
      [
        "timeline with 7 events",
        edited("timeline", (c) => {
          c.events = [...c.events, ...c.events, c.events[0]];
        }),
      ],
      ["timeline date over 16", edited("timeline", (c) => (c.events[0].date = long(17)))],
      ["timeline label over 40", edited("timeline", (c) => (c.events[0].label = long(41)))],
      [
        "bar chart with 7 bars",
        edited("barChart", (c) => {
          c.bars = [...c.bars, ...c.bars, c.bars[0]];
        }),
      ],
      ["negative bar", edited("barChart", (c) => (c.bars[0].value = -1))],
      [
        "pie chart with 6 slices",
        edited("pieChart", (c) => {
          c.slices = [...c.slices, ...c.slices, ...c.slices];
        }),
      ],
      [
        "pie chart of zeros",
        edited("pieChart", (c) => {
          for (const slice of c.slices) slice.value = 0;
        }),
      ],
      ["icon grid with 3 items", edited("iconGrid", (c) => (c.items = c.items.slice(0, 3)))],
      ["icon grid label over 24", edited("iconGrid", (c) => (c.items[0].label = long(25)))],
      ["icon grid item without an icon", edited("iconGrid", (c) => delete c.items[0].icon)],
      ["stat value over 12", edited("statCallout", (c) => (c.value = long(13)))],
      ["stat label over 80", edited("statCallout", (c) => (c.label = long(81)))],
      [
        "quiz with 5 options",
        edited("quiz", (c) => {
          c.options = [...c.options, ...c.options.slice(0, 2)];
        }),
      ],
      ["quiz answer not an option", edited("quiz", (c) => (c.answerIndex = 3))],
      ["quiz without a reveal", edited("quiz", (c) => delete c.reveal)],
      [
        "recap with 5 points",
        edited("recap", (c) => {
          c.points = [...c.points, ...c.points.slice(0, 2)];
        }),
      ],
      ["recap call to action over 40", edited("recap", (c) => (c.cta = long(41)))],
      ["source over 80", edited("barChart", (c) => (c.source = long(81)))],
      ["trigger over 40", edited("bullets", (c) => (c.items[0].trigger = long(41)))],
      ["empty trigger", edited("bullets", (c) => (c.items[0].trigger = ""))],
    ];
    for (const [what, value] of refused) expect(valid(value), what).toBe(false);

    // The edges themselves are fine.
    expect(valid(edited("title", (c) => (c.heading = long(60))))).toBe(true);
    expect(valid(edited("comparison", (c) => (c.left.points = c.left.points.slice(0, 1))))).toBe(
      true,
    );
    expect(valid(edited("pieChart", (c) => (c.slices[1].value = 0)))).toBe(true);
  });

  it("trims on-screen text and refuses blank text and control characters", () => {
    expect(valid(edited("title", (c) => (c.heading = "Bad\u0000title")))).toBe(false);
    expect(valid(edited("title", (c) => (c.heading = "Two\nlines")))).toBe(false);
    expect(valid(edited("bullets", (c) => (c.heading = "   ")))).toBe(false);
    expect(valid(edited("flowchart", (c) => (c.steps[0].label = "  ")))).toBe(false);
    expect(valid(edited("bullets", (c) => (c.items[0].trigger = " \t ")))).toBe(false);
    const trimmed = scene.parse(edited("title", (c) => (c.heading = "  UPI in a minute  ")));
    expect(trimmed.content).toMatchObject({ heading: "UPI in a minute" });
    // Narration may span lines, but not hold control characters.
    expect(valid({ ...exampleScenes.recap, narration: "Hello\u0000 world" })).toBe(false);
    expect(
      valid({ ...exampleScenes.recap, narration: `${exampleScenes.recap.narration}\nMore.` }),
    ).toBe(true);
  });

  it("takes only icons from the closed list", () => {
    expect(iconNames).toHaveLength(102);
    expect(new Set(iconNames).size).toBe(iconNames.length);
    expect(valid(edited("title", (c) => (c.icon = "Unicorn")))).toBe(false);
    expect(valid(edited("title", (c) => (c.icon = "Rocket")))).toBe(true);
  });

  it("refuses content from another template, and an unknown template", () => {
    expect(valid({ ...exampleScenes.bullets, template: "flowchart" })).toBe(false);
    expect(valid({ ...exampleScenes.bullets, template: "spinningCube" })).toBe(false);
    expect(templateContent.quiz.safeParse(exampleScenes.recap.content).success).toBe(false);
  });

  it("lists triggers in on-screen order, whatever order the fields were written in", () => {
    const backwards = {
      reveal: { trigger: "The answer" },
      answerIndex: 2,
      options: [
        { trigger: "Your bank", text: "Your bank" },
        { trigger: "the shop", text: "The shop" },
      ],
      questionTrigger: "who sees your PIN",
      question: "Who sees your UPI PIN?",
    };
    expect(triggersOf(backwards)).toEqual([
      { path: "questionTrigger", trigger: "who sees your PIN" },
      { path: "options[0].trigger", trigger: "Your bank" },
      { path: "options[1].trigger", trigger: "the shop" },
      { path: "reveal.trigger", trigger: "The answer" },
    ]);
    expect(triggersOf(exampleScenes.comparison.content).map((t) => t.trigger)).toEqual([
      "Cash",
      "needs change",
      "the ATM",
      "UPI needs",
      "your phone",
      "a PIN",
    ]);
  });
});
