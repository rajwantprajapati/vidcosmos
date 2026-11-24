"use client";

// The Remotion Player and scene thumbnails (SDD §4 "Preview player"): `Explainer` from
// @vidcosmos/video with the draft spec and the narration links as `assets`, so the preview is
// the export, frame for frame. Loaded with `next/dynamic` (no server rendering), so the rest of
// the editor isn't held up by it. The page's own fonts are the video's fonts (same names).
import { Player, type PlayerRef, Thumbnail } from "@remotion/player";
import type { VideoSpec } from "@vidcosmos/spec/video";
import { compositionSize, Explainer, totalFrames } from "@vidcosmos/video";
import type { CSSProperties, Ref } from "react";

const fps = 30;

export type VideoPlayerProps = {
  spec: VideoSpec;
  /** Signed URLs by narration asset id. */
  assets: Record<string, string>;
  playerRef: Ref<PlayerRef>;
  style?: CSSProperties;
};

export function VideoPlayer({ spec, assets, playerRef, style }: VideoPlayerProps) {
  const size = compositionSize(spec);
  return (
    <Player
      ref={playerRef}
      component={Explainer}
      inputProps={{ spec, assets }}
      durationInFrames={Math.max(1, totalFrames(spec))}
      compositionWidth={size.width}
      compositionHeight={size.height}
      fps={fps}
      controls={false}
      clickToPlay={false}
      doubleClickToFullscreen={false}
      spaceKeyToPlayOrPause={false}
      acknowledgeRemotionLicense
      style={{ width: "100%", height: "100%", ...style }}
    />
  );
}

export type SceneThumbnailProps = {
  spec: VideoSpec;
  /** The frame to show: a moment into the scene, once its elements are in. */
  frame: number;
  style?: CSSProperties;
};

/** One still of the video, drawn by the same composition (no audio). */
export function SceneThumbnail({ spec, frame, style }: SceneThumbnailProps) {
  const size = compositionSize(spec);
  return (
    <Thumbnail
      component={Explainer}
      inputProps={{ spec, assets: {} }}
      compositionWidth={size.width}
      compositionHeight={size.height}
      durationInFrames={Math.max(1, totalFrames(spec))}
      frameToDisplay={frame}
      fps={fps}
      style={{ width: "100%", height: "100%", ...style }}
    />
  );
}
