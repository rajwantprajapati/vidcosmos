// Where each scene sits on the Player's timeline (SDD §9 "Preview"): scene start frames from
// each scene's length (its recording, or the estimate from its words), the scene playing at a
// frame, and how times read in the editor ("0:19 / 0:56", "5.2 s").
import { msToFrame, videoTiming, type VideoSpec } from "@vidcosmos/spec/video";
import { sceneFrames, totalFrames } from "@vidcosmos/video";

export type Timeline = {
  /** Each scene's first frame. */
  starts: number[];
  /** Each scene's length in frames. */
  lengths: number[];
  total: number;
};

export function timelineOf(spec: VideoSpec): Timeline {
  const lengths = spec.scenes.map((scene) => sceneFrames(scene, spec));
  const starts: number[] = [];
  lengths.reduce((at, length) => {
    starts.push(at);
    return at + length;
  }, 0);
  return { starts, lengths, total: totalFrames(spec) };
}

/** The scene playing at `frame` (0-based); the last one at or past the end. */
export function sceneIndexAt(timeline: Timeline, frame: number): number {
  let index = 0;
  timeline.starts.forEach((start, i) => {
    if (frame >= start) index = i;
  });
  return index;
}

export const framesToMs = (frames: number) => (frames / videoTiming.fps) * 1000;
export { msToFrame };

/** "0:19", "1:05": minutes and seconds, rounded down. */
export function clock(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/** "5.2 s": a scene's length. */
export const seconds = (ms: number) => `${(Math.round(ms / 100) / 10).toFixed(1)} s`;
