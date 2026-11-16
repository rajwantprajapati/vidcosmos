// The script (PRD M2, API §6, DB §5): word count, estimated length and how well it fits the
// chosen length, the first sentence (the hook), and the two script requests. Shared by the
// API, the jobs, the LLM step and the editor, so they all count the same way.
import { z } from "zod";
import { controlCharacterMessage, isPlainText } from "./text.ts";

/** The longest script, in characters (DB §5). */
export const scriptMaxChars = 1800;

/** Words per second of narration (DB §5, API §6: en 2.5, hi 2.2). */
export const wordsPerSecond = { en: 2.5, hi: 2.2 } as const;
export type ScriptLanguage = keyof typeof wordsPerSecond;

/**
 * Spoken words: runs of text between spaces that hold a letter or a digit. A dash, a full stop
 * standing alone or a Hindi danda (।) with a space before it is not a word.
 */
export function countWords(text: string): number {
  let count = 0;
  for (const token of text.split(/\s+/)) if (/[\p{L}\p{N}]/u.test(token)) count += 1;
  return count;
}

/** Word count and the estimated narration length in seconds, to one decimal (DB §5). */
export function scriptStats(text: string, language: ScriptLanguage) {
  const wordCount = countWords(text);
  return {
    wordCount,
    estDurationSec: Math.round((wordCount / wordsPerSecond[language]) * 10) / 10,
  };
}

/** How many words a script of this length should have (PRD FR-2.1: 30/60/90 s ≈ 75/150/225). */
export const targetWords = (lengthSec: number, language: ScriptLanguage) =>
  Math.round(lengthSec * wordsPerSecond[language]);

/** How far the estimate may be from the target before the editor says so (PRD FR-2.4). */
export const fitTolerance = 0.15;

export type ScriptFit = "fits" | "over" | "under";

/** Whether a script of `estDurationSec` fits a video of `lengthSec`, within 15% either way. */
export function scriptFit(estDurationSec: number, lengthSec: number): ScriptFit {
  if (estDurationSec > lengthSec * (1 + fitTolerance)) return "over";
  if (estDurationSec < lengthSec * (1 - fitTolerance)) return "under";
  return "fits";
}

/** The first sentence of the script: its hook (DB §5). At most 400 characters. */
export function firstSentence(text: string): string {
  const trimmed = text.trim();
  const end = /[.!?।]["”’)]*(\s|$)/u.exec(trimmed);
  const sentence = end ? trimmed.slice(0, end.index + end[0].trimEnd().length) : trimmed;
  return sentence.replace(/\s+/g, " ").slice(0, 400).trim();
}

const instructions = z.string().trim().max(500).refine(isPlainText(true), controlCharacterMessage);

// POST /projects/{id}/script
export const requestScriptInput = z.object({
  /** Default: the angle picked in step 1, if any. */
  angleId: z.string().min(1).max(40).optional(),
  instructions: instructions.optional(),
  /** Required to replace a script the user edited (`409 STAGE_INVALID`, `needs: 'overwrite'`). */
  overwrite: z.boolean().optional(),
});
export type RequestScriptInput = z.infer<typeof requestScriptInput>;

export const rewriteInstruction = z.enum([
  "shorter",
  "longer",
  "simpler",
  "more_engaging",
  "more_formal",
  "custom",
]);
export type RewriteInstruction = z.infer<typeof rewriteInstruction>;

// POST /projects/{id}/script/rewrite
export const rewriteScriptInput = z
  .object({
    instruction: rewriteInstruction,
    /** Required for `custom`. */
    custom: instructions.pipe(z.string().min(1)).optional(),
    /** Character offsets in the script: rewrites only that part. */
    selection: z
      .object({ start: z.int().min(0), end: z.int().min(1) })
      .refine((s) => s.end > s.start, { message: "The selection is empty." })
      .optional(),
  })
  .refine((value) => value.instruction !== "custom" || value.custom, {
    message: "Say how to rewrite it.",
    path: ["custom"],
  });
export type RewriteScriptInput = z.infer<typeof rewriteScriptInput>;
