// When each element appears (SDD §7 "Element times are derived, not stored"), ported from the
// prototype's `applyTiming`: each trigger is found among the words the narrator says, and the
// element appears as its first word starts. The Player and the renderer work these out from
// `timing.words`, so an edit to on-screen text or a trigger shows at once, with no new audio.
//
// A scene without a recording yet gets words spaced at the language's speaking rate, so the
// storyboard, Studio and stills can play it. A trigger that isn't found is placed evenly
// between its neighbours; a list's elements never appear out of order.
import { wordsPerSecond } from "../api/script.ts";
import type { Scene } from "./schema.ts";
import { videoTiming } from "./schema.ts";
import { triggersOf } from "./templates.ts";
import { findSequence, normalizeWord, tokenize } from "./text.ts";

export type SpokenWord = { text: string; startMs: number; endMs: number };

/** Each element's appearance, in ms from the start of the scene, by its trigger's path. */
export type ElementTimes = Record<string, number>;

/** The gap kept between elements of one list, so they never appear in the same frame. */
export const listStepMs = 150;

/**
 * The words the narrator says in a scene, in ms from the start of its narration: the
 * recording's, or spaced at the speaking rate when there's no recording yet.
 */
export function sceneWords(scene: Scene, language: "en" | "hi", speed = 1): SpokenWord[] {
  if (scene.timing) return scene.timing.words;
  const each = 1000 / (wordsPerSecond[language] * speed);
  return scene.narration
    .split(/\s+/)
    .filter(Boolean)
    .map((text, i) => ({ text, startMs: Math.round(i * each), endMs: Math.round((i + 1) * each) }));
}

/** Silence before the narration starts in this scene. */
export const sceneLeadInMs = (scene: Scene) => scene.timing?.leadInMs ?? videoTiming.leadInMs;

/** The list a trigger path belongs to ("left.points"), or null for a single field. */
function listOf(path: string): string | null {
  const match = /^(.*)\[\d+\][^[]*$/.exec(path);
  return match ? match[1]! : null;
}

/**
 * When each element appears, by trigger path, in ms from the start of the scene (the
 * lead-in included). Every trigger gets a time.
 */
export function elementTimes(scene: Scene, language: "en" | "hi", speed = 1): ElementTimes {
  const words = sceneWords(scene, language, speed);
  const leadIn = sceneLeadInMs(scene);
  const spoken = words.map((word) => normalizeWord(word.text));
  const refs = triggersOf(scene.content as Record<string, unknown>);
  const cursors = new Map<string, number>();
  const times: (number | null)[] = refs.map(({ path, trigger }) => {
    const needle = tokenize(trigger);
    const list = listOf(path);
    const from = list === null ? 0 : (cursors.get(list) ?? 0);
    let at = findSequence(spoken, needle, from);
    if (at === -1) at = findSequence(spoken, needle);
    if (at === -1) return null;
    if (list !== null) cursors.set(list, at + needle.length);
    return leadIn + words[at]!.startMs;
  });

  // Not found: evenly between the neighbours that were.
  const lastWord = words.at(-1);
  const end = leadIn + (lastWord ? lastWord.endMs * 0.9 : 0);
  for (let i = 0; i < times.length; i++) {
    if (times[i] !== null) continue;
    let j = i;
    while (j < times.length && times[j] === null) j++;
    const from = i > 0 ? times[i - 1]! : leadIn;
    const to = j < times.length ? times[j]! : Math.max(end, from);
    const step = (to - from) / (j - i + 1);
    for (let k = i; k < j; k++) times[k] = from + step * (k - i + 1);
    i = j - 1;
  }

  // Each list in order: an item never appears before the one above it.
  const lastInList = new Map<string, number>();
  const result: ElementTimes = {};
  refs.forEach(({ path }, i) => {
    let at = Math.round(times[i]!);
    const list = listOf(path);
    if (list !== null) {
      const previous = lastInList.get(list);
      if (previous !== undefined) at = Math.max(at, previous + listStepMs);
      lastInList.set(list, at);
    }
    result[path] = at;
  });
  return result;
}
