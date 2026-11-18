// What the "Edit scene" panel shows for each template (F17): the scene's on-screen fields in
// groups, each with its limit, and the words each element appears on. One description for
// all 12 templates, so the panel is one component; paths address `scene.content`.
//
// Adding and removing elements, and scenes, comes with manual scene editing (F23).
import type { Scene } from "./schema.ts";
import { limits } from "./templates.ts";

export type FormField =
  | {
      kind: "text";
      path: string;
      label: string;
      max: number;
      required: boolean;
      /** The trigger that goes with an optional text: cleared with it. */
      trigger?: string;
    }
  /** Words from the narration; an optional one left empty is on screen from the start. */
  | { kind: "trigger"; path: string; label: string; required: boolean }
  | { kind: "icon"; path: string; label: string; required: boolean }
  | { kind: "number"; path: string; label: string }
  | { kind: "choice"; path: string; label: string; options: { value: string; label: string }[] };

export type FormGroup = { title: string; fields: FormField[] };

const text = (path: string, label: string, max: number, required = true, trigger?: string) =>
  ({ kind: "text", path, label, max, required, ...(trigger ? { trigger } : {}) }) as const;
const on = (path: string, required = true) =>
  ({ kind: "trigger", path, label: "Appears on", required }) as const;
const icon = (path: string, required = false) =>
  ({ kind: "icon", path, label: "Icon", required }) as const;

/** The heading over a list, on screen from the start unless it has words to wait for. */
const headingGroup = (): FormGroup => ({
  title: "Heading",
  fields: [text("heading", "Heading", limits.heading), on("headingTrigger", false)],
});

/** The scene's fields for the edit panel, in the order they appear on screen. */
export function sceneForm(scene: Scene): FormGroup[] {
  switch (scene.template) {
    case "title":
      return [
        {
          title: "Heading",
          fields: [text("heading", "Heading", limits.title.heading), on("headingTrigger")],
        },
        {
          title: "Subheading",
          fields: [
            text("subheading", "Subheading", limits.title.subheading, false, "subheadingTrigger"),
            on("subheadingTrigger", false),
          ],
        },
        { title: "Icon", fields: [icon("icon")] },
      ];
    case "bullets":
      return [
        headingGroup(),
        ...scene.content.items.map((_, i) => ({
          title: `Item ${i + 1}`,
          fields: [
            text(`items[${i}].text`, "Text", limits.bullets.text),
            on(`items[${i}].trigger`),
            icon(`items[${i}].icon`),
          ],
        })),
      ];
    case "keyTerm":
      return [
        {
          title: "Term",
          fields: [text("term", "Term", limits.keyTerm.term), on("termTrigger"), icon("icon")],
        },
        {
          title: "Definition",
          fields: [
            text("definition", "Definition", limits.keyTerm.definition),
            on("definitionTrigger", false),
          ],
        },
      ];
    case "flowchart":
      return [
        {
          ...headingGroup(),
          fields: [
            ...headingGroup().fields,
            {
              kind: "choice",
              path: "layout",
              label: "Layout",
              options: [
                { value: "linear", label: "One step after another" },
                { value: "cycle", label: "A cycle" },
              ],
            },
          ],
        },
        ...scene.content.steps.map((_, i) => ({
          title: `Step ${i + 1}`,
          fields: [
            text(`steps[${i}].label`, "Label", limits.flowchart.label),
            on(`steps[${i}].trigger`),
            icon(`steps[${i}].icon`),
          ],
        })),
      ];
    case "comparison": {
      const side = (name: "left" | "right", title: string): FormGroup[] => [
        {
          title,
          fields: [
            text(`${name}.title`, "Title", limits.comparison.title),
            on(`${name}.titleTrigger`),
            icon(`${name}.icon`),
          ],
        },
        ...scene.content[name].points.map((_, i) => ({
          title: `${title}, point ${i + 1}`,
          fields: [
            text(`${name}.points[${i}].text`, "Text", limits.comparison.point),
            on(`${name}.points[${i}].trigger`),
          ],
        })),
      ];
      return [headingGroup(), ...side("left", "Left side"), ...side("right", "Right side")];
    }
    case "timeline":
      return [
        headingGroup(),
        ...scene.content.events.map((_, i) => ({
          title: `Event ${i + 1}`,
          fields: [
            text(`events[${i}].date`, "Date", limits.timeline.date),
            text(`events[${i}].label`, "Label", limits.timeline.label),
            on(`events[${i}].trigger`),
          ],
        })),
      ];
    case "barChart":
      return [
        {
          ...headingGroup(),
          fields: [
            ...headingGroup().fields,
            text("unit", "Unit", limits.barChart.unit, false),
            text("source", "Source", limits.source, false),
          ],
        },
        ...scene.content.bars.map((_, i) => ({
          title: `Bar ${i + 1}`,
          fields: [
            text(`bars[${i}].label`, "Label", limits.barChart.label),
            { kind: "number", path: `bars[${i}].value`, label: "Value" } as const,
            on(`bars[${i}].trigger`),
          ],
        })),
      ];
    case "pieChart":
      return [
        {
          ...headingGroup(),
          fields: [...headingGroup().fields, text("source", "Source", limits.source, false)],
        },
        ...scene.content.slices.map((_, i) => ({
          title: `Slice ${i + 1}`,
          fields: [
            text(`slices[${i}].label`, "Label", limits.pieChart.label),
            { kind: "number", path: `slices[${i}].value`, label: "Value" } as const,
            on(`slices[${i}].trigger`),
          ],
        })),
      ];
    case "iconGrid":
      return [
        headingGroup(),
        ...scene.content.items.map((_, i) => ({
          title: `Item ${i + 1}`,
          fields: [
            text(`items[${i}].label`, "Label", limits.iconGrid.label),
            on(`items[${i}].trigger`),
            icon(`items[${i}].icon`, true),
          ],
        })),
      ];
    case "statCallout":
      return [
        {
          title: "Number",
          fields: [
            text("value", "Number", limits.statCallout.value),
            on("valueTrigger"),
            icon("icon"),
          ],
        },
        {
          title: "Label",
          fields: [
            text("label", "Label", limits.statCallout.label),
            on("labelTrigger", false),
            text("source", "Source", limits.source, false),
          ],
        },
      ];
    case "quiz":
      return [
        {
          title: "Question",
          fields: [
            text("question", "Question", limits.quiz.question),
            on("questionTrigger", false),
          ],
        },
        ...scene.content.options.map((_, i) => ({
          title: `Option ${i + 1}`,
          fields: [
            text(`options[${i}].text`, "Text", limits.quiz.option),
            on(`options[${i}].trigger`),
          ],
        })),
        {
          title: "Answer",
          fields: [
            {
              kind: "choice",
              path: "answerIndex",
              label: "Right answer",
              options: scene.content.options.map((option, i) => ({
                value: String(i),
                label: option.text,
              })),
            } as const,
            { ...on("reveal.trigger"), label: "Shown on" },
          ],
        },
      ];
    case "recap":
      return [
        headingGroup(),
        ...scene.content.points.map((_, i) => ({
          title: `Point ${i + 1}`,
          fields: [
            text(`points[${i}].text`, "Text", limits.recap.text),
            on(`points[${i}].trigger`),
          ],
        })),
        {
          title: "Call to action",
          fields: [
            text("cta", "Call to action", limits.recap.cta, false, "ctaTrigger"),
            on("ctaTrigger", false),
          ],
        },
      ];
  }
}
