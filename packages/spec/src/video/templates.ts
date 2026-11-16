// The 12 V1 templates (DB §6 "Templates"): each one's content fields and limits. Every
// element on screen has a trigger: words copied from the scene's narration; the element
// appears when the narrator says them. Element objects carry `trigger` (and `atMs` once the
// pipeline resolves it); single fields carry `<field>Trigger` and `<field>AtMs`, as in the
// prototype. A heading without a trigger is on screen from the start of the scene.
//
// Limits keep text readable on the narrowest canvas (9:16) and are the same in every format,
// so changing format never makes a valid scene invalid.
import { z } from "zod";
import { controlCharacterMessage, isPlainText } from "../api/text.ts";
import { iconNames } from "./icons.ts";

export const icon = z.enum(iconNames);

/**
 * One line of on-screen text: trimmed, not blank, no control characters (a NUL, an escape,
 * a newline). This text reaches the LLM, the voice and the renderer.
 */
export const lineText = (max: number) =>
  z.string().trim().min(1).max(max).refine(isPlainText(false), controlCharacterMessage);

/** Words copied exactly from this scene's narration; the element appears as they're said. */
export const trigger = lineText(40);

/** When the element appears, in ms from the start of the scene. Filled by the pipeline. */
export const atMs = z.number().min(0).optional();

const text = lineText;

/** Character limits per template field, for the editor's counters and the LLM's prompt. */
export const limits = {
  heading: 48,
  title: { heading: 60, subheading: 80 },
  bullets: { min: 2, max: 5, text: 60 },
  keyTerm: { term: 40, definition: 140 },
  flowchart: { min: 3, max: 6, label: 28 },
  comparison: { title: 24, min: 1, max: 4, point: 40 },
  timeline: { min: 3, max: 6, date: 16, label: 40 },
  barChart: { min: 2, max: 6, label: 20, unit: 12 },
  pieChart: { min: 2, max: 5, label: 20 },
  iconGrid: { min: 4, max: 6, label: 24 },
  statCallout: { value: 12, label: 80 },
  quiz: { question: 120, min: 2, max: 4, option: 60 },
  recap: { min: 2, max: 4, text: 60, cta: 40 },
  source: 80,
} as const;

/** A heading over the scene's content, on screen from the start unless it has a trigger. */
const heading = {
  heading: text(limits.heading),
  headingTrigger: trigger.optional(),
  headingAtMs: atMs,
};

const element = { trigger, atMs };

export const titleContent = z.object({
  heading: text(limits.title.heading),
  headingTrigger: trigger,
  headingAtMs: atMs,
  subheading: text(limits.title.subheading).optional(),
  subheadingTrigger: trigger.optional(),
  subheadingAtMs: atMs,
  icon: icon.optional(),
});

export const bulletsContent = z.object({
  ...heading,
  items: z
    .array(z.object({ text: text(limits.bullets.text), icon: icon.optional(), ...element }))
    .min(limits.bullets.min)
    .max(limits.bullets.max),
});

export const keyTermContent = z.object({
  term: text(limits.keyTerm.term),
  termTrigger: trigger,
  termAtMs: atMs,
  definition: text(limits.keyTerm.definition),
  definitionTrigger: trigger.optional(),
  definitionAtMs: atMs,
  icon: icon.optional(),
});

export const flowchartContent = z.object({
  ...heading,
  /** `cycle`: the last step leads back to the first. */
  layout: z.enum(["linear", "cycle"]),
  steps: z
    .array(z.object({ label: text(limits.flowchart.label), icon: icon.optional(), ...element }))
    .min(limits.flowchart.min)
    .max(limits.flowchart.max),
});

const comparisonSide = z.object({
  title: text(limits.comparison.title),
  titleTrigger: trigger,
  titleAtMs: atMs,
  icon: icon.optional(),
  points: z
    .array(z.object({ text: text(limits.comparison.point), ...element }))
    .min(limits.comparison.min)
    .max(limits.comparison.max),
});

export const comparisonContent = z.object({
  ...heading,
  left: comparisonSide,
  right: comparisonSide,
});

export const timelineContent = z.object({
  ...heading,
  events: z
    .array(
      z.object({
        date: text(limits.timeline.date),
        label: text(limits.timeline.label),
        ...element,
      }),
    )
    .min(limits.timeline.min)
    .max(limits.timeline.max),
});

const chartValue = z.number().min(0).max(1e12);

export const barChartContent = z.object({
  ...heading,
  unit: text(limits.barChart.unit).optional(),
  bars: z
    .array(z.object({ label: text(limits.barChart.label), value: chartValue, ...element }))
    .min(limits.barChart.min)
    .max(limits.barChart.max),
  source: text(limits.source).optional(),
});

export const pieChartContent = z.object({
  ...heading,
  /** Shown as percentages of their total. */
  slices: z
    .array(z.object({ label: text(limits.pieChart.label), value: chartValue, ...element }))
    .min(limits.pieChart.min)
    .max(limits.pieChart.max)
    .refine((slices) => slices.some((slice) => slice.value > 0), {
      message: "At least one slice needs a value above 0.",
    }),
  source: text(limits.source).optional(),
});

export const iconGridContent = z.object({
  ...heading,
  items: z
    .array(z.object({ icon, label: text(limits.iconGrid.label), ...element }))
    .min(limits.iconGrid.min)
    .max(limits.iconGrid.max),
});

export const statCalloutContent = z.object({
  /** e.g. "72%" or "₹1.2 lakh". */
  value: text(limits.statCallout.value),
  valueTrigger: trigger,
  valueAtMs: atMs,
  label: text(limits.statCallout.label),
  labelTrigger: trigger.optional(),
  labelAtMs: atMs,
  icon: icon.optional(),
  source: text(limits.source).optional(),
});

export const quizContent = z
  .object({
    question: text(limits.quiz.question),
    questionTrigger: trigger.optional(),
    questionAtMs: atMs,
    options: z
      .array(z.object({ text: text(limits.quiz.option), ...element }))
      .min(limits.quiz.min)
      .max(limits.quiz.max),
    answerIndex: z.int().min(0),
    /** When the right answer is shown. */
    reveal: z.object({ ...element }),
  })
  .refine((quiz) => quiz.answerIndex < quiz.options.length, {
    message: "The answer must be one of the options.",
    path: ["answerIndex"],
  });

export const recapContent = z.object({
  ...heading,
  points: z
    .array(z.object({ text: text(limits.recap.text), ...element }))
    .min(limits.recap.min)
    .max(limits.recap.max),
  cta: text(limits.recap.cta).optional(),
  ctaTrigger: trigger.optional(),
  ctaAtMs: atMs,
});

/** Each template's content schema, by template name. */
export const templateContent = {
  title: titleContent,
  bullets: bulletsContent,
  keyTerm: keyTermContent,
  flowchart: flowchartContent,
  comparison: comparisonContent,
  timeline: timelineContent,
  barChart: barChartContent,
  pieChart: pieChartContent,
  iconGrid: iconGridContent,
  statCallout: statCalloutContent,
  quiz: quizContent,
  recap: recapContent,
} as const;

export type TemplateName = keyof typeof templateContent;
export const templateNames = Object.keys(templateContent) as TemplateName[];
export type TemplateContent<T extends TemplateName = TemplateName> = z.infer<
  (typeof templateContent)[T]
>;

/** One element's trigger and where it sits in the content, in the order it's shown. */
export type TriggerRef = { path: string; trigger: string };

/**
 * The order things appear on screen within a template, by field. Triggers are checked
 * against the narration in this order, whatever order the fields were written in.
 */
const screenOrder = [
  "heading",
  "title",
  "term",
  "value",
  "question",
  "subheading",
  "definition",
  "label",
  "text",
  "date",
  "left",
  "right",
  "items",
  "steps",
  "points",
  "events",
  "bars",
  "slices",
  "options",
  "reveal",
  "cta",
];

/** A field's place in `screenOrder`: `headingTrigger` and `headingAtMs` go with `heading`. */
function rank(key: string): number {
  const base = key.replace(/(Trigger|AtMs)$/, "");
  const index = screenOrder.indexOf(base);
  return index === -1 ? screenOrder.length : index;
}

/**
 * Every trigger in a scene's content, in on-screen order: the heading first, then the
 * elements in turn, then anything shown last, such as a quiz's reveal or a recap's call to
 * action.
 */
export function triggersOf(content: Record<string, unknown>): TriggerRef[] {
  const found: TriggerRef[] = [];
  const visit = (value: unknown, path: string) => {
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, `${path}[${index}]`));
      return;
    }
    if (!value || typeof value !== "object") return;
    const keys = Object.keys(value).sort((a, b) => rank(a) - rank(b));
    for (const key of keys) {
      const child = (value as Record<string, unknown>)[key];
      const here = path ? `${path}.${key}` : key;
      if ((key === "trigger" || key.endsWith("Trigger")) && typeof child === "string") {
        found.push({ path: here, trigger: child });
      } else {
        visit(child, here);
      }
    }
  };
  visit(content, "");
  return found;
}
