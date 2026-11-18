// Word helpers shared by the checks, the timing step and the LLM steps, ported from the
// prototype. They work for Latin and Devanagari: letters, marks and digits in any script.

/**
 * Lowercase, NFC, punctuation removed, apostrophes included: "It’s", "It's" and "Its" are
 * one word, whichever apostrophe a keyboard or an LLM typed.
 */
export function normalizeWord(word: string): string {
  return word
    .toLowerCase()
    .normalize("NFC")
    .replace(/[^\p{L}\p{M}\p{N}]/gu, "");
}

/** Hyphens and dashes split words: "step-by-step" is "step by step". */
const wordBreak = /[\s\u002D\u2010-\u2015\u2212]+/u;

/** The words of a text, normalised, empty ones dropped. */
export function tokenize(text: string): string[] {
  return text.split(wordBreak).map(normalizeWord).filter(Boolean);
}

/** Where `needle` first appears as consecutive words in `hay`, from `from` on; -1 if not. */
export function findSequence(hay: string[], needle: string[], from = 0): number {
  if (needle.length === 0) return -1;
  outer: for (let i = from; i <= hay.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (hay[i + j] !== needle[j]) continue outer;
    }
    return i;
  }
  return -1;
}

/** The share of `a`'s words that appear in order in `b` (longest common subsequence / |a|). */
export function orderedCoverage(a: string[], b: string[]): number {
  if (a.length === 0) return 1;
  // O(n·m) is fine for scripts of a few hundred words.
  let previous = new Array<number>(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    const current = new Array<number>(b.length + 1).fill(0);
    for (let j = 1; j <= b.length; j++) {
      current[j] =
        a[i - 1] === b[j - 1] ? previous[j - 1]! + 1 : Math.max(previous[j]!, current[j - 1]!);
    }
    previous = current;
  }
  return previous[b.length]! / a.length;
}

/** A word of a text and where it sits: `start` and `end` are character offsets. */
export type WordSpan = { word: string; start: number; end: number };

/**
 * The words of a text with their places, normalised as `tokenize` does (and in the same
 * order), so a match found in `tokenize(text)` can be shown in the text itself.
 */
export function wordSpans(text: string): WordSpan[] {
  const spans: WordSpan[] = [];
  const pattern = /[^\s\-‐-―−]+/gu;
  for (const match of text.matchAll(pattern)) {
    const word = normalizeWord(match[0]);
    if (!word) continue;
    // Leave punctuation around the word out of the highlight ("money." shows "money").
    const lead = /^[^\p{L}\p{M}\p{N}]*/u.exec(match[0])![0].length;
    const trail = /[^\p{L}\p{M}\p{N}]*$/u.exec(match[0])![0].length;
    spans.push({ word, start: match.index + lead, end: match.index + match[0].length - trail });
  }
  return spans;
}

/**
 * Where each trigger is said in the narration, as character ranges, in the order given;
 * null for a trigger that isn't there. Each one is looked for from the start, as the checks
 * do for single fields.
 */
export function triggerRanges(
  narration: string,
  triggers: string[],
): ({ start: number; end: number } | null)[] {
  const spans = wordSpans(narration);
  const words = spans.map((span) => span.word);
  return triggers.map((trigger) => {
    const needle = tokenize(trigger);
    const at = findSequence(words, needle);
    if (at === -1) return null;
    return { start: spans[at]!.start, end: spans[at + needle.length - 1]!.end };
  });
}
