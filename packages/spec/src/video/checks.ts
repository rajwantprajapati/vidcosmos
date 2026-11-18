// The rules zod can't express (DB §6 "Rules checked on every write"), run on the server after
// the schema, for the AI's output and the user's edits alike:
// - each trigger's words appear in its scene's narration, and each list's items in the order
//   they're said;
// - scene ids are unique;
// - once every scene has timing, the video lasts 20-100 s; before that, its estimate from the
//   words is 20-110 s;
// - on generation, the scenes' narration reproduces the approved script (at least 95% of
//   its words, at most 5% extra).
// A scene whose timing no longer matches its narration and voice loses it
// (`reconcileTiming`), so it is recorded again.
import { narrationHash } from "./hash.ts";
import { estimatedVideoMs } from "./scenes.ts";
import type { VideoSpec } from "./schema.ts";
import { videoTiming } from "./schema.ts";
import { triggersOf } from "./templates.ts";
import { findSequence, orderedCoverage, tokenize } from "./text.ts";

export type SpecIssueCode =
  | "TRIGGER_NOT_IN_NARRATION"
  | "TRIGGER_OUT_OF_ORDER"
  | "DUPLICATE_SCENE_ID"
  | "DURATION_OUT_OF_RANGE"
  | "NARRATION_MISMATCH";

export type SpecIssue = {
  code: SpecIssueCode;
  /** The scene it's about; null for the whole video. */
  sceneId: string | null;
  /** Where in the scene's content, e.g. "items[2].trigger". */
  path?: string;
  message: string;
};

/** How much of the script the narration must cover, and how much it may add (DB §6). */
export const scriptCoverage = { min: 0.95, maxExtra: 0.05 } as const;

/** The list an element's trigger belongs to ("left.points"), or null for a single field. */
function listOf(path: string): string | null {
  const match = /^(.*)\[\d+\][^[]*$/.exec(path);
  return match ? match[1]! : null;
}

/**
 * Fields shown once a list is complete, and that list: a quiz's answer comes after its last
 * option, a recap's call to action after its last point.
 */
const closers: Record<string, string> = { "reveal.trigger": "options", ctaTrigger: "points" };

/**
 * Triggers in a scene: each one spoken in the narration, and the elements of each list
 * (items, steps, a side's points, events, bars, slices, options) in the order they're said.
 * A quiz's reveal and a recap's call to action come after the list they close. Headings,
 * titles and other single fields may be said anywhere in the scene (decision log, 16 Nov).
 */
function triggerIssues(scene: VideoSpec["scenes"][number]): SpecIssue[] {
  const words = tokenize(scene.narration);
  const issues: SpecIssue[] = [];
  /** Where the last element of each list was said. */
  const listPosition = new Map<string, number>();
  for (const { path, trigger } of triggersOf(scene.content as Record<string, unknown>)) {
    const needle = tokenize(trigger);
    if (findSequence(words, needle) === -1) {
      issues.push({
        code: "TRIGGER_NOT_IN_NARRATION",
        sceneId: scene.id,
        path,
        message: `“${trigger}” isn’t in this scene’s narration. Use words the narrator says.`,
      });
      continue;
    }
    const closes = closers[path];
    if (closes !== undefined) {
      const last = listPosition.get(closes);
      if (last !== undefined && findSequence(words, needle, last + 1) === -1) {
        issues.push({
          code: "TRIGGER_OUT_OF_ORDER",
          sceneId: scene.id,
          path,
          message: `“${trigger}” must be said after the last ${closes === "options" ? "option" : "point"}, so it comes once the list is complete.`,
        });
      }
      continue;
    }
    const list = listOf(path);
    if (list === null) continue;
    // Elements may share a moment: the next one can start at the same word.
    const at = findSequence(words, needle, listPosition.get(list) ?? 0);
    if (at === -1) {
      issues.push({
        code: "TRIGGER_OUT_OF_ORDER",
        sceneId: scene.id,
        path,
        message: `“${trigger}” is said before the item above it. A list’s items must follow the narration’s order.`,
      });
      continue;
    }
    listPosition.set(list, at);
  }
  return issues;
}

/** Total length once every scene has timing; null while any scene is still without audio. */
export function totalDurationMs(spec: VideoSpec): number | null {
  let total = 0;
  for (const scene of spec.scenes) {
    if (!scene.timing) return null;
    total += scene.timing.durationMs;
  }
  return total;
}

/** Does the scenes' narration, joined, reproduce the script word for word (near enough)? */
export function narrationIssues(spec: VideoSpec, script: string): SpecIssue[] {
  const scriptWords = tokenize(script);
  const spoken = spec.scenes.flatMap((scene) => tokenize(scene.narration));
  const coverage = orderedCoverage(scriptWords, spoken);
  const extra = 1 - orderedCoverage(spoken, scriptWords);
  if (coverage >= scriptCoverage.min && extra <= scriptCoverage.maxExtra) return [];
  return [
    {
      code: "NARRATION_MISMATCH",
      sceneId: null,
      message: `The scenes’ narration must reproduce the script word for word: it covers ${Math.round(coverage * 100)}% of the script and adds ${Math.round(extra * 100)}% other words.`,
    },
  ];
}

/**
 * Every rule above for a spec that passed the schema. `script` is given on generation only:
 * after that the user may change narration freely.
 */
export function specIssues(spec: VideoSpec, options: { script?: string } = {}): SpecIssue[] {
  const issues: SpecIssue[] = [];
  const seen = new Set<string>();
  for (const scene of spec.scenes) {
    if (seen.has(scene.id)) {
      issues.push({
        code: "DUPLICATE_SCENE_ID",
        sceneId: scene.id,
        message: `Two scenes have the id “${scene.id}”; each needs its own.`,
      });
    }
    seen.add(scene.id);
    issues.push(...triggerIssues(scene));
  }
  const total = totalDurationMs(spec);
  if (total !== null && (total < videoTiming.minTotalMs || total > videoTiming.maxTotalMs)) {
    issues.push({
      code: "DURATION_OUT_OF_RANGE",
      sceneId: null,
      message: `The video lasts ${Math.round(total / 1000)} s; it needs to be ${videoTiming.minTotalMs / 1000}-${videoTiming.maxTotalMs / 1000} s.`,
    });
  } else if (total === null) {
    // Not recorded yet: the estimate from the words, with a margin for its roughness, so
    // narration isn't recorded for a video that can't be made.
    const estimate = estimatedVideoMs(spec);
    const seconds = Math.round(estimate / 1000);
    if (estimate > videoTiming.maxTotalMs + videoTiming.estimateMarginMs) {
      issues.push({
        code: "DURATION_OUT_OF_RANGE",
        sceneId: null,
        message: `About ${seconds} s of narration: a video can be at most ${videoTiming.maxTotalMs / 1000} s. Shorten some scenes.`,
      });
    } else if (estimate < videoTiming.minTotalMs) {
      issues.push({
        code: "DURATION_OUT_OF_RANGE",
        sceneId: null,
        message: `About ${seconds} s of narration: a video needs at least ${videoTiming.minTotalMs / 1000} s. Add to the narration.`,
      });
    }
  }
  if (options.script !== undefined) issues.push(...narrationIssues(spec, options.script));
  return issues;
}

/**
 * Clears the timing of every scene whose recording no longer matches its narration and the
 * spec's voice and language, and returns the spec with the ids of those scenes. Scenes that
 * still match keep their audio.
 */
export function reconcileTiming(spec: VideoSpec): { spec: VideoSpec; cleared: string[] } {
  const cleared: string[] = [];
  const scenes = spec.scenes.map((scene) => {
    if (!scene.timing) return scene;
    const hash = narrationHash(scene.narration, spec.language, spec.voice);
    if (hash === scene.timing.narrationHash) return scene;
    cleared.push(scene.id);
    return { ...scene, timing: null };
  });
  return { spec: { ...spec, scenes }, cleared };
}
