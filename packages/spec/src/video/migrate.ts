// Reading older specs (DB §6, SDD §12 "migrateSpec"). Applied whenever a spec is read, so
// old projects keep opening. Today that means the prototype's two shapes:
// - its finished video spec: no `format` (read as "9:16"), no voice, music as a file path,
//   and timing that points at an audio file;
// - its storyboard (what the LLM returned): title, palette and scenes only.
// Audio file paths can't become asset ids, so that timing is dropped: those scenes are
// recorded again. What a shape doesn't say (language, voice) comes from `defaults`.
import type { z } from "zod";
import type { captionStyle, videoFormat } from "../collections/common.ts";
import { type SpecVoice, type VideoSpec, videoSpec } from "./schema.ts";

export type MigrateDefaults = {
  language?: VideoSpec["language"];
  voice?: SpecVoice;
  format?: z.infer<typeof videoFormat>;
  captionStyle?: z.infer<typeof captionStyle>;
};

type Loose = Record<string, unknown>;
const isObject = (value: unknown): value is Loose =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

/** Timing that points at a stored asset is kept; the prototype's file paths are not. */
function migrateTiming(timing: unknown): unknown {
  if (!isObject(timing) || typeof timing.narrationAssetId !== "string") return null;
  const words = Array.isArray(timing.words)
    ? timing.words.map((word: unknown) =>
        isObject(word) && word.text === undefined
          ? { ...word, text: word.word, word: undefined }
          : word,
      )
    : timing.words;
  return { ...timing, words };
}

function migrateScene(raw: unknown): unknown {
  if (!isObject(raw)) return raw;
  return { ...raw, userEdited: raw.userEdited ?? false, timing: migrateTiming(raw.timing) };
}

/**
 * Any stored or prototype spec as today's `VideoSpec`, validated. Throws a ZodError when it
 * still doesn't fit, or an Error when a needed default is missing.
 */
export function migrateSpec(raw: unknown, defaults: MigrateDefaults = {}): VideoSpec {
  if (!isObject(raw)) throw new Error("A video spec must be an object.");
  // The prototype wrote version 1 too; a later version needs its own migration step here.
  if (raw.version !== undefined && raw.version !== 1) {
    throw new Error(`Video spec version ${String(raw.version)} isn't supported.`);
  }
  const theme = isObject(raw.theme)
    ? raw.theme
    : { palette: raw.palette, captionStyle: defaults.captionStyle ?? "highlight" };
  const language = raw.language ?? defaults.language;
  const voice = raw.voice ?? defaults.voice;
  if (language === undefined) throw new Error("This spec has no language; pass one in defaults.");
  if (voice === undefined) throw new Error("This spec has no voice; pass one in defaults.");
  // The prototype's music was a file; V1 music is a track from the library.
  const music =
    isObject(raw.music) && typeof raw.music.trackId === "string"
      ? { duck: true, ...raw.music }
      : null;
  const { palette: _palette, ...rest } = raw;
  return videoSpec.parse({
    ...rest,
    version: 1,
    format: raw.format ?? defaults.format ?? "9:16",
    language,
    voice,
    theme,
    music,
    scenes: Array.isArray(raw.scenes) ? raw.scenes.map(migrateScene) : raw.scenes,
  });
}
