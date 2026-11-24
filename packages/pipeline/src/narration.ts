// Narration and timing (SDD §8 "Narration step in detail"), the pure parts: which scenes need
// a recording and what it's keyed by, what a recording costs, and the timing step, which turns
// a recording into the scene's `timing` (300 ms lead-in + audio + 400 ms tail). Element times
// and captions come from the words when the video plays (`elementTimes`, F18), so nothing
// else is stored.
import {
  narrationHash,
  type Scene,
  type SceneTiming,
  sceneTiming,
  type VideoSpec,
  videoTiming,
} from "@vidcosmos/spec/video";

/** A scene to record: what the narrator says, with what voice, and the cache key. */
export type NarrationTask = {
  sceneId: string;
  text: string;
  language: VideoSpec["language"];
  voiceId: string;
  model: string;
  speed: number;
  /** `narrationHash`: the `assets` cache key and the scene's `timing.narrationHash`. */
  hash: string;
};

/** Whether a scene's recording still matches its narration and the video's voice. */
export function hasCurrentTiming(scene: Scene, spec: VideoSpec): boolean {
  return (
    scene.timing !== null &&
    scene.timing.narrationHash === narrationHash(scene.narration, spec.language, spec.voice)
  );
}

/**
 * The scenes to record: `sceneIds` if given (in the video's order), otherwise every scene
 * without a current recording (API §7 "Narration for some scenes"). Generate records them all,
 * and the cache makes unchanged ones free.
 */
export function narrationTasks(spec: VideoSpec, sceneIds?: string[]): NarrationTask[] {
  const wanted = sceneIds ? new Set(sceneIds) : null;
  return spec.scenes
    .filter((scene) => (wanted ? wanted.has(scene.id) : !hasCurrentTiming(scene, spec)))
    .map((scene) => ({
      sceneId: scene.id,
      text: scene.narration,
      language: spec.language,
      voiceId: spec.voice.voiceId,
      model: spec.voice.model,
      speed: spec.voice.speed,
      hash: narrationHash(scene.narration, spec.language, spec.voice),
    }));
}

/** A recording, as stored in `assets` and returned by the voice service. */
export type Recording = {
  assetId: string;
  hash: string;
  durationMs: number;
  words: SceneTiming["words"];
  timingSource: SceneTiming["timingSource"];
};

/** The timing step: a recording becomes the scene's timing. */
export function timingOf(recording: Recording): SceneTiming {
  const leadInMs = videoTiming.leadInMs;
  const audioDurationMs = Math.max(1, Math.round(recording.durationMs));
  return sceneTiming.parse({
    narrationAssetId: recording.assetId,
    narrationHash: recording.hash,
    audioDurationMs,
    leadInMs,
    durationMs: leadInMs + audioDurationMs + videoTiming.tailMs,
    words: recording.words,
    timingSource: recording.timingSource,
  });
}

/**
 * The spec with each recorded scene's timing set. A recording only goes on a scene whose
 * narration and voice still match it, so an edit made while it was recorded keeps the scene
 * waiting for new audio instead of playing the old words.
 */
export function withTimings(spec: VideoSpec, recordings: Record<string, Recording>): VideoSpec {
  return {
    ...spec,
    scenes: spec.scenes.map((scene) => {
      const recording = recordings[scene.id];
      if (!recording) return scene;
      const current = narrationHash(scene.narration, spec.language, spec.voice);
      return recording.hash === current ? { ...scene, timing: timingOf(recording) } : scene;
    }),
  };
}

// ---- Cost ----

export const narrationPriceVersion = "2026-11";

/**
 * USD per 1,000 characters (ElevenLabs pay-as-you-go, SDD §15: about $0.09 for a 60-second
 * video's 900 characters). A new price is a new version.
 */
const narrationPrices: Record<string, number> = {
  eleven_multilingual_v2: 0.1,
};

/** What a recording cost, in integer micro-dollars. The stub costs nothing. */
export function narrationCost(
  provider: "elevenlabs" | "stub",
  model: string,
  characters: number,
): { costMicroUsd: number; priceVersion: string } {
  if (provider === "stub") return { costMicroUsd: 0, priceVersion: narrationPriceVersion };
  const price = narrationPrices[model];
  if (price === undefined) {
    return { costMicroUsd: 0, priceVersion: `${narrationPriceVersion}:unpriced` };
  }
  return {
    costMicroUsd: Math.round((characters / 1000) * price * 1_000_000),
    priceVersion: narrationPriceVersion,
  };
}
