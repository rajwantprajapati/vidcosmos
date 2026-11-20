// Entrance, emphasis and exit timing (PRD FR-4.3), ported from the prototype: an element
// springs in on the frame its trigger word starts, pulses once, and stays lit while it's the
// one being talked about.
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { msToFrame } from "@vidcosmos/spec/video";

/** 0 → 1, a spring that starts as the narrator says the element's words. */
export function useAppear(
  atMs: number | undefined,
  options: { delay?: number; damping?: number } = {},
) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const start = msToFrame(atMs ?? 0) + (options.delay ?? 0);
  return spring({
    frame: frame - start,
    fps,
    config: { damping: options.damping ?? 16, mass: 0.7, stiffness: 120 },
  });
}

/** 1 → peak → 1 just after the element appears: the emphasis beat. */
export function usePulse(atMs: number | undefined, peak = 1.05) {
  const frame = useCurrentFrame();
  const start = msToFrame(atMs ?? 0) + 8;
  return interpolate(frame - start, [0, 6, 14], [1, peak, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}

/** True from the element's moment until the next one's. */
export function useIsActive(atMs: number | undefined, untilMs: number | undefined) {
  const frame = useCurrentFrame();
  const from = msToFrame(atMs ?? 0);
  const to = untilMs === undefined ? Number.POSITIVE_INFINITY : msToFrame(untilMs);
  return frame >= from && frame < to;
}

/** 0 → 1 over `frames` frames from `atMs`. */
export function useDraw(atMs: number | undefined, delay = 0, frames = 12) {
  const frame = useCurrentFrame();
  return interpolate(frame - msToFrame(atMs ?? 0) - delay, [0, frames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}
