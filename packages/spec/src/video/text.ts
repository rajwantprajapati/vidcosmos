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
