// Hashes over the spec (DB §6). Pure JavaScript (`@noble/hashes`), so the editor in the
// browser computes the same values as the server.
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import type { SpecVoice, VideoSpec } from "./schema.ts";

const hex = (text: string) => bytesToHex(sha256(utf8ToBytes(text)));

/**
 * What a scene's audio was made from: its narration, the language and the voice (id, model,
 * speed). The format is not part of it, so a format change keeps every recording.
 */
export function narrationHash(
  narration: string,
  language: VideoSpec["language"],
  voice: Pick<SpecVoice, "voiceId" | "model" | "speed">,
): string {
  return hex(JSON.stringify([narration, language, voice.voiceId, voice.model, voice.speed]));
}

/** JSON with every object's keys sorted, so equal values always serialise the same way. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, inner: unknown) => {
    if (inner && typeof inner === "object" && !Array.isArray(inner)) {
      return Object.fromEntries(
        Object.keys(inner)
          .sort()
          .map((key) => [key, (inner as Record<string, unknown>)[key]]),
      );
    }
    return inner;
  });
}

/**
 * sha256 of the spec with sorted keys. It covers everything that changes a frame (format,
 * theme, text, timing), so two specs with the same hash render the same MP4 and an export
 * can be reused. `userEdited` doesn't change a frame, so it's left out.
 */
export function specHash(spec: VideoSpec): string {
  const scenes = spec.scenes.map(({ userEdited: _edited, ...scene }) => scene);
  return hex(canonicalJson({ ...spec, scenes }));
}
