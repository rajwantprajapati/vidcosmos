// Specs for tests: built from the example scenes, optionally with recorded timing whose
// `narrationHash` matches, as the pipeline would leave it.
import { exampleScenes } from "./examples.ts";
import { narrationHash } from "./hash.ts";
import { type SceneInput, type VideoSpec, videoSpec } from "./schema.ts";

export const testVoice = {
  gender: "female",
  voiceId: "voice_female_1",
  model: "eleven_multilingual_v2",
  speed: 1,
} as const;

/** A valid spec of the given example scenes; `timed` gives each one matching audio. */
export function testSpec(
  scenes: SceneInput[] = [exampleScenes.title, exampleScenes.flowchart, exampleScenes.recap],
  options: { timed?: boolean; durationMs?: number } = {},
): VideoSpec {
  const spec = videoSpec.parse({
    version: 1,
    format: "9:16",
    title: "How UPI moves your money",
    language: "en",
    voice: testVoice,
    theme: { palette: "ocean", captionStyle: "highlight" },
    scenes,
  });
  if (!options.timed) return spec;
  const durationMs = options.durationMs ?? 8000;
  return {
    ...spec,
    scenes: spec.scenes.map((scene, index) => ({
      ...scene,
      timing: {
        narrationAssetId: index.toString(16).padStart(24, "a"),
        narrationHash: narrationHash(scene.narration, spec.language, spec.voice),
        audioDurationMs: durationMs - 700,
        leadInMs: 300,
        durationMs,
        words: scene.narration.split(" ").map((text, i) => ({
          text,
          startMs: i * 300,
          endMs: i * 300 + 280,
        })),
        timingSource: "provider" as const,
      },
    })),
  };
}
