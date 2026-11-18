// Scenes as the storyboard shows and edits them (PRD M3, F17): each template's name, a
// scene's headline and on-screen elements with the words they appear on, how long a scene
// lasts before it's recorded, and a scene switched to another template by hand.
//
// Switching template keeps what fits: the heading, each element's text, trigger, icon and
// number. Missing elements are filled from words the narrator says, so their triggers are
// right; a chart made from text gets the numbers its labels mention, or 1 each, for the
// person to set (decision log, 17 Nov).
import { countWords, wordsPerSecond } from "../api/script.ts";
import type { IconName } from "./icons.ts";
import { type Scene, scene as sceneSchema, type VideoSpec, videoTiming } from "./schema.ts";
import { limits, type TemplateName, triggersOf } from "./templates.ts";
import { tokenize, wordSpans } from "./text.ts";

/** What each template is called in the app, in the order the template picker lists them. */
export const templateLabels: Record<TemplateName, string> = {
  title: "Title",
  bullets: "Bullets",
  keyTerm: "Key term",
  flowchart: "Flowchart",
  comparison: "Comparison",
  timeline: "Timeline",
  barChart: "Bar chart",
  pieChart: "Pie chart",
  iconGrid: "Icon grid",
  statCallout: "Stat callout",
  quiz: "Quiz",
  recap: "Recap",
};

// ---- Paths ----

/** "left.points[1].trigger" as keys: ["left", "points", 1, "trigger"]. */
export function pathKeys(path: string): (string | number)[] {
  const keys: (string | number)[] = [];
  for (const part of path.split(".")) {
    const match = /^([^[]*)((?:\[\d+\])*)$/.exec(part);
    if (!match) throw new Error(`Not a content path: ${path}`);
    if (match[1]) keys.push(match[1]);
    for (const index of match[2]!.matchAll(/\[(\d+)\]/g)) keys.push(Number(index[1]));
  }
  return keys;
}

/** The value at `path` in `root`, or undefined. */
export function valueAt(root: unknown, path: string): unknown {
  let here: unknown = root;
  for (const key of pathKeys(path)) {
    if (here === null || typeof here !== "object") return undefined;
    here = (here as Record<string | number, unknown>)[key];
  }
  return here;
}

/** A copy of `root` with `value` at `path`; undefined removes the field. */
export function withValueAt<T>(root: T, path: string, value: unknown): T {
  const keys = pathKeys(path);
  const set = (node: unknown, at: number): unknown => {
    const key = keys[at]!;
    // Arrays are indexed by number keys like objects here; `delete` is never used on them.
    const copy = (
      Array.isArray(node) ? [...(node as unknown[])] : { ...(node as Record<string, unknown>) }
    ) as Record<string | number, unknown>;
    if (at === keys.length - 1) {
      if (value === undefined && !Array.isArray(copy)) delete copy[key];
      else copy[key] = value;
    } else {
      copy[key] = set(copy[key] ?? (typeof keys[at + 1] === "number" ? [] : {}), at + 1);
    }
    return copy;
  };
  return set(root, 0) as T;
}

// ---- What a scene shows ----

/** The scene's main text: its heading, term, value or question. */
export function sceneHeadline(scene: Scene): string {
  const c = scene.content as Record<string, unknown>;
  const text = c.heading ?? c.term ?? c.question ?? c.value;
  return typeof text === "string" ? text : "";
}

export type SceneElement = {
  /** The trigger's path in the content, e.g. "items[1].trigger". */
  path: string;
  /** What appears: the element's text. */
  label: string;
  trigger: string;
};

/** The text an element shows, from where its trigger sits. */
function elementLabel(content: Record<string, unknown>, path: string): string {
  if (path === "reveal.trigger") {
    const options = content.options as { text: string }[];
    const answer = options[content.answerIndex as number];
    return answer ? `Answer “${answer.text}”` : "Answer";
  }
  if (path.endsWith(".trigger")) {
    const owner = valueAt(content, path.slice(0, -".trigger".length)) as Record<string, unknown>;
    const text = owner.text ?? owner.label;
    return typeof text === "string" ? text : "";
  }
  const field = valueAt(content, path.replace(/Trigger$/, ""));
  return typeof field === "string" ? field : "";
}

/** Everything that appears on screen with a trigger, in the order it appears. */
export function sceneElements(scene: Scene): SceneElement[] {
  const content = scene.content as Record<string, unknown>;
  return triggersOf(content).map(({ path, trigger }) => ({
    path,
    label: elementLabel(content, path),
    trigger,
  }));
}

/** Fields that aren't text people read: trigger words (the narration's), icons and layout. */
const notShown = (key: string) =>
  key === "trigger" || key.endsWith("Trigger") || key === "icon" || key === "layout";

/**
 * Every text a scene puts on screen: headings, labels, dates, a quiz's question and options,
 * units, sources. Not its trigger words (they're narration), icons or layout.
 */
export function sceneTexts(scene: Scene): string[] {
  const found: string[] = [];
  const visit = (value: unknown, key: string) => {
    if (notShown(key)) return;
    if (typeof value === "string") found.push(value);
    else if (Array.isArray(value)) value.forEach((item) => visit(item, ""));
    else if (value && typeof value === "object") {
      for (const [child, inner] of Object.entries(value)) visit(inner, child);
    }
  };
  visit(scene.content, "");
  return found;
}

/**
 * What an edit adds that people will hear or read, for moderation: the narration of each
 * scene that's new or changed, and on-screen text (and the title) not shown before.
 */
export function addedTexts(
  before: VideoSpec | null,
  after: VideoSpec,
): { narration: string[]; onScreen: string[] } {
  const said = new Map((before?.scenes ?? []).map((scene) => [scene.id, scene.narration]));
  const shown = new Set([
    ...(before ? [before.title] : []),
    ...(before?.scenes ?? []).flatMap(sceneTexts),
  ]);
  const narration = after.scenes
    .filter((scene) => said.get(scene.id) !== scene.narration)
    .map((scene) => scene.narration);
  const onScreen = [after.title, ...after.scenes.flatMap(sceneTexts)].filter(
    (text) => !shown.has(text),
  );
  return { narration, onScreen: [...new Set(onScreen)] };
}

/**
 * How long a scene lasts: its recording once it has one, or an estimate from its words at the
 * language's speaking rate and the narrator's speed, with the lead-in and tail (PRD FR-5.5).
 */
export function estimatedSceneMs(scene: Scene, language: "en" | "hi", speed = 1): number {
  if (scene.timing) return scene.timing.durationMs;
  const speakingMs = (countWords(scene.narration) / (wordsPerSecond[language] * speed)) * 1000;
  return Math.round(speakingMs) + videoTiming.leadInMs + videoTiming.tailMs;
}

/** The whole video's length: recorded where it is, estimated where it isn't. */
export function estimatedVideoMs(spec: VideoSpec): number {
  return spec.scenes.reduce(
    (sum, scene) => sum + estimatedSceneMs(scene, spec.language, spec.voice.speed),
    0,
  );
}

// ---- Words from the narration ----

/** Short, common words that make poor on-screen labels. */
const commonWords = new Set(
  "about after also because been before being does each even from have here into just more most much only other over some such than that their them then there these they this those very were what when where which while will with would your".split(
    " ",
  ),
);

export type Keyword = {
  /** As shown on screen: the word with a capital letter. */
  text: string;
  /** As the narrator says it, for the trigger. */
  trigger: string;
  /** Its place among the narration's words. */
  index: number;
};

const letters = (word: string) => [...word.matchAll(/\p{L}/gu)].length;

/**
 * `count` different words from the narration, in the order they're said, from word `from` on
 * (then from the start), skipping `exclude`d words; longer words first choice, any word after.
 */
export function narrationKeywords(
  narration: string,
  count: number,
  options: { from?: number; exclude?: Iterable<string> } = {},
): Keyword[] {
  const spans = wordSpans(narration);
  const used = new Set([...(options.exclude ?? [])].map((word) => tokenize(word).join(" ")));
  const order = spans.map((_, i) => i);
  const from = Math.min(options.from ?? 0, spans.length);
  const rotated = [...order.slice(from), ...order.slice(0, from)];
  const picked: Keyword[] = [];
  const take = (good: (word: string) => boolean) => {
    for (const index of rotated) {
      if (picked.length >= count) return;
      const span = spans[index]!;
      if (used.has(span.word) || !good(span.word)) continue;
      used.add(span.word);
      const original = narration.slice(span.start, span.end);
      picked.push({
        text: original.charAt(0).toUpperCase() + original.slice(1),
        trigger: original,
        index,
      });
    }
  };
  take((word) => letters(word) >= 4 && !commonWords.has(word));
  take((word) => letters(word) >= 2);
  take(() => true);
  return picked.sort((a, b) => a.index - b.index);
}

// ---- Switching template ----

/** At most `max` characters, cut at a word where it can be. */
export function clipText(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max / 2 ? cut.slice(0, space) : cut).replace(/[\s,.;:–—-]+$/u, "")}…`;
}

/** Something a scene shows, whatever its template. */
type Piece = { text: string; trigger?: string; icon?: IconName; value?: number; date?: string };

/** The scene's headline and elements, without the template's shape. */
function piecesOf(scene: Scene): { headline: Piece | null; pieces: Piece[]; icon?: IconName } {
  const piece = (
    text: string | undefined,
    trigger: string | undefined,
    extra: Partial<Piece> = {},
  ) => (text ? [{ text, ...(trigger ? { trigger } : {}), ...extra }] : []);
  switch (scene.template) {
    case "title": {
      const c = scene.content;
      return {
        headline: { text: c.heading, trigger: c.headingTrigger },
        pieces: piece(c.subheading, c.subheadingTrigger),
        icon: c.icon,
      };
    }
    case "bullets":
      return {
        headline: { text: scene.content.heading, trigger: scene.content.headingTrigger },
        pieces: scene.content.items.map((i) => ({
          text: i.text,
          trigger: i.trigger,
          icon: i.icon,
        })),
      };
    case "keyTerm": {
      const c = scene.content;
      return {
        headline: { text: c.term, trigger: c.termTrigger },
        pieces: piece(c.definition, c.definitionTrigger),
        icon: c.icon,
      };
    }
    case "flowchart":
      return {
        headline: { text: scene.content.heading, trigger: scene.content.headingTrigger },
        pieces: scene.content.steps.map((s) => ({
          text: s.label,
          trigger: s.trigger,
          icon: s.icon,
        })),
      };
    case "comparison": {
      const c = scene.content;
      const side = (s: typeof c.left): Piece[] => [
        { text: s.title, trigger: s.titleTrigger, ...(s.icon ? { icon: s.icon } : {}) },
        ...s.points.map((p) => ({ text: p.text, trigger: p.trigger })),
      ];
      return {
        headline: { text: c.heading, trigger: c.headingTrigger },
        pieces: [...side(c.left), ...side(c.right)],
      };
    }
    case "timeline":
      return {
        headline: { text: scene.content.heading, trigger: scene.content.headingTrigger },
        pieces: scene.content.events.map((e) => ({
          text: e.label,
          trigger: e.trigger,
          date: e.date,
        })),
      };
    case "barChart":
    case "pieChart": {
      const c = scene.content;
      const values = "bars" in c ? c.bars : c.slices;
      return {
        headline: { text: c.heading, trigger: c.headingTrigger },
        pieces: values.map((v) => ({ text: v.label, trigger: v.trigger, value: v.value })),
      };
    }
    case "iconGrid":
      return {
        headline: { text: scene.content.heading, trigger: scene.content.headingTrigger },
        pieces: scene.content.items.map((i) => ({
          text: i.label,
          trigger: i.trigger,
          icon: i.icon,
        })),
      };
    case "statCallout": {
      const c = scene.content;
      return {
        headline: { text: c.label, trigger: c.labelTrigger ?? c.valueTrigger },
        pieces: [{ text: c.value, trigger: c.valueTrigger }],
        icon: c.icon,
      };
    }
    case "quiz":
      return {
        headline: { text: scene.content.question, trigger: scene.content.questionTrigger },
        pieces: scene.content.options.map((o) => ({ text: o.text, trigger: o.trigger })),
      };
    case "recap": {
      const c = scene.content;
      return {
        headline: { text: c.heading, trigger: c.headingTrigger },
        pieces: [
          ...c.points.map((p) => ({ text: p.text, trigger: p.trigger })),
          ...piece(c.cta, c.ctaTrigger),
        ],
      };
    }
  }
}

/** Icons for an icon grid made from elements that had none. */
const gridIcons: IconName[] = ["Lightbulb", "Target", "Star", "Sparkles", "Puzzle", "Layers"];

/** The first number a text mentions ("46%" is 46), if any. */
function numberIn(text: string): number | undefined {
  const match = /\d[\d,]*(?:\.\d+)?/.exec(text);
  if (!match) return undefined;
  const value = Number(match[0].replace(/,/g, ""));
  return Number.isFinite(value) ? value : undefined;
}

/**
 * `scene` shown with another template, by hand: no AI request. Keeps its id, narration and
 * recording; the new content keeps what fits and takes the rest from the narration.
 */
export function convertScene(scene: Scene, template: TemplateName): Scene {
  if (scene.template === template) return scene;
  const narration = scene.narration;
  const { headline, pieces: all, icon } = piecesOf(scene);
  const words = tokenize(narration);
  const said = (trigger: string | undefined) => {
    if (!trigger) return -1;
    const needle = tokenize(trigger);
    for (let i = 0; i + needle.length <= words.length; i++) {
      if (needle.every((word, j) => words[i + j] === word)) return i;
    }
    return -1;
  };
  // Elements whose triggers the narrator says, so the new scene starts without issues.
  const pieces = all.filter((p) => said(p.trigger) !== -1);
  const usedTriggers = [headline?.trigger, ...pieces.map((p) => p.trigger)].filter(
    (t): t is string => Boolean(t),
  );

  /**
   * `min` to `max` elements: the scene's own (`from`), then words the narrator says after
   * them, never the `keep` words.
   */
  const fill = (
    min: number,
    max: number,
    from: Piece[] = pieces,
    keep: string[] = [],
  ): (Piece & { trigger: string })[] => {
    const own = from.slice(0, max) as (Piece & { trigger: string })[];
    if (own.length >= min) return own;
    const after = Math.max(-1, ...own.map((p) => said(p.trigger))) + 1;
    const extra = narrationKeywords(narration, min - own.length, {
      from: after,
      exclude: [...usedTriggers, ...keep],
    }).map((k) => ({ text: k.text, trigger: k.trigger }));
    // In the order they're said, as lists must be.
    return [...own, ...extra].sort((a, b) => said(a.trigger) - said(b.trigger));
  };
  const lead =
    headline && said(headline.trigger) !== -1
      ? headline
      : { text: headline?.text ?? pieces[0]?.text ?? narration, trigger: undefined };
  const leadTrigger = () =>
    lead.trigger ?? narrationKeywords(narration, 1, { exclude: usedTriggers })[0]!.trigger;
  const heading = {
    heading: clipText(lead.text, limits.heading),
    ...(lead.trigger ? { headingTrigger: lead.trigger } : {}),
  };
  const withIcon = (i: IconName | undefined) => (i ? { icon: i } : {});

  const content = ((): Record<string, unknown> => {
    switch (template) {
      case "title": {
        const sub = pieces[0];
        return {
          heading: clipText(lead.text, limits.title.heading),
          headingTrigger: leadTrigger(),
          ...(sub
            ? {
                subheading: clipText(sub.text, limits.title.subheading),
                subheadingTrigger: sub.trigger,
              }
            : {}),
          ...withIcon(icon),
        };
      }
      case "bullets":
        return {
          ...heading,
          items: fill(limits.bullets.min, limits.bullets.max).map((p) => ({
            text: clipText(p.text, limits.bullets.text),
            ...withIcon(p.icon),
            trigger: p.trigger,
          })),
        };
      case "keyTerm": {
        const definition = pieces[0];
        return {
          term: clipText(lead.text, limits.keyTerm.term),
          termTrigger: leadTrigger(),
          definition: clipText(definition?.text ?? narration, limits.keyTerm.definition),
          ...(definition?.trigger ? { definitionTrigger: definition.trigger } : {}),
          ...withIcon(icon),
        };
      }
      case "flowchart":
        return {
          ...heading,
          layout: "linear",
          steps: fill(limits.flowchart.min, limits.flowchart.max).map((p) => ({
            label: clipText(p.text, limits.flowchart.label),
            ...withIcon(p.icon),
            trigger: p.trigger,
          })),
        };
      case "comparison": {
        const elements = fill(4, 2 * (limits.comparison.max + 1));
        const half = Math.ceil(elements.length / 2);
        const side = (part: typeof elements) => ({
          title: clipText(part[0]!.text, limits.comparison.title),
          titleTrigger: part[0]!.trigger,
          ...withIcon(part[0]!.icon),
          points: part.slice(1).map((p) => ({
            text: clipText(p.text, limits.comparison.point),
            trigger: p.trigger,
          })),
        });
        return {
          ...heading,
          left: side(elements.slice(0, half)),
          right: side(elements.slice(half)),
        };
      }
      case "timeline":
        return {
          ...heading,
          events: fill(limits.timeline.min, limits.timeline.max).map((p, i) => ({
            date: clipText(p.date ?? String(i + 1), limits.timeline.date),
            label: clipText(p.text, limits.timeline.label),
            trigger: p.trigger,
          })),
        };
      case "barChart":
      case "pieChart": {
        const range = template === "barChart" ? limits.barChart : limits.pieChart;
        const values = fill(range.min, range.max).map((p) => ({
          label: clipText(p.text, range.label),
          value: p.value ?? numberIn(p.text) ?? 1,
          trigger: p.trigger,
        }));
        // A pie needs something to show.
        if (template === "pieChart" && values.every((v) => v.value === 0)) {
          for (const v of values) v.value = 1;
        }
        return { ...heading, [template === "barChart" ? "bars" : "slices"]: values };
      }
      case "iconGrid":
        return {
          ...heading,
          items: fill(limits.iconGrid.min, limits.iconGrid.max).map((p, i) => ({
            icon: p.icon ?? gridIcons[i % gridIcons.length]!,
            label: clipText(p.text, limits.iconGrid.label),
            trigger: p.trigger,
          })),
        };
      case "statCallout": {
        // The number the narrator says, if there is one.
        const number = wordSpans(narration).find((span) => /^\d/.test(span.word));
        const value = number ? narration.slice(number.start, number.end) : lead.text;
        return {
          value: clipText(value, limits.statCallout.value),
          valueTrigger: number ? narration.slice(number.start, number.end) : leadTrigger(),
          label: clipText(
            number ? lead.text : (pieces[0]?.text ?? lead.text),
            limits.statCallout.label,
          ),
          ...(number && lead.trigger ? { labelTrigger: lead.trigger } : {}),
          ...withIcon(icon),
        };
      }
      case "quiz": {
        // The answer is shown on the narration's last word, after every option.
        const spans = wordSpans(narration);
        const last = spans.at(-1)!;
        const reveal = narration.slice(last.start, last.end);
        const before = pieces.filter(
          (p) => said(p.trigger) + tokenize(p.trigger!).length - 1 < spans.length - 1,
        );
        const options = fill(limits.quiz.min, limits.quiz.max, before, [reveal]);
        return {
          question: clipText(lead.text, limits.quiz.question),
          ...(lead.trigger ? { questionTrigger: lead.trigger } : {}),
          options: options.map((o) => ({
            text: clipText(o.text, limits.quiz.option),
            trigger: o.trigger,
          })),
          answerIndex: 0,
          reveal: { trigger: reveal },
        };
      }
      case "recap":
        return {
          ...heading,
          points: fill(limits.recap.min, limits.recap.max).map((p) => ({
            text: clipText(p.text, limits.recap.text),
            trigger: p.trigger,
          })),
        };
    }
  })();

  return sceneSchema.parse({
    id: scene.id,
    template,
    narration,
    userEdited: scene.userEdited,
    timing: scene.timing,
    content,
  });
}
