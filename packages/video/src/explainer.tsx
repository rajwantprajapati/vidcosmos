// `Explainer` (SDD §9): the one composition that draws a video from its spec, in the browser's
// Player and in the renderer alike. Its size comes from `spec.format`; each scene lasts its
// recording (or the estimate from its words) and plays its narration from `assets`, the URLs
// for each `narrationAssetId` (and `music:<trackId>`), which never live in the spec. Captions
// follow the words; music ducks under the narrator.
import { useMemo, type ReactNode } from "react";
import {
  AbsoluteFill,
  Html5Audio,
  interpolate,
  Sequence,
  Series,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  elementTimes,
  estimatedSceneMs,
  formats,
  msToFrame,
  type Scene,
  sceneLeadInMs,
  sceneWords,
  type VideoSpec,
} from "@vidcosmos/spec/video";
import { Captions } from "./captions";
import { fontFamilies } from "./fonts";
import { type Stage, stageOf } from "./format";
import { LayoutCheck } from "./layout-check";
import { BulletsScene } from "./templates/bullets";
import { ComparisonScene } from "./templates/comparison";
import { FallbackScene } from "./templates/fallback";
import { FlowchartScene } from "./templates/flowchart";
import { TitleScene } from "./templates/title";
import { type VideoTheme, videoTheme } from "./theme";

export type ExplainerProps = {
  spec: VideoSpec;
  /** URLs by narration asset id, and `music:<trackId>` for the music. */
  assets?: Record<string, string>;
  /** Report text outside the safe area to the console (the stills command). */
  checkLayout?: boolean;
};

/** Frames a scene lasts. */
export const sceneFrames = (scene: Scene, spec: VideoSpec) =>
  Math.max(1, msToFrame(estimatedSceneMs(scene, spec.language, spec.voice.speed)));

export const totalFrames = (spec: VideoSpec) =>
  spec.scenes.reduce((sum, scene) => sum + sceneFrames(scene, spec), 0);

/** The canvas at 1080p for the spec's format. */
export const compositionSize = (spec: Pick<VideoSpec, "format">) => ({
  width: formats[spec.format].width,
  height: formats[spec.format].height,
});

/** A slow, soft glow and a drifting dot grid behind every scene. */
function Background({ theme, stage }: { theme: VideoTheme; stage: Stage }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const glow = (x: number, y: number, r: number) => (
    <div
      style={{
        position: "absolute",
        left: x - r,
        top: y - r,
        width: r * 2,
        height: r * 2,
        borderRadius: r,
        background: `radial-gradient(circle, ${theme.glow} 0%, transparent 70%)`,
      }}
    />
  );
  const { width: w, height: h } = stage;
  return (
    <AbsoluteFill style={{ background: theme.bg }}>
      {glow(
        w * 0.2 + 80 * Math.sin(t * 0.35),
        h * 0.22 + 60 * Math.cos(t * 0.3),
        Math.min(w, h) * 0.48,
      )}
      {glow(
        w * 0.82 + 70 * Math.cos(t * 0.28),
        h * 0.76 + 80 * Math.sin(t * 0.33),
        Math.min(w, h) * 0.55,
      )}
      <AbsoluteFill
        style={{
          backgroundImage: `radial-gradient(${theme.line} 2px, transparent 2px)`,
          backgroundSize: "56px 56px",
          opacity: 0.5,
          transform: `translateY(${(-t * 6) % 56}px)`,
        }}
      />
    </AbsoluteFill>
  );
}

function SceneBody({
  scene,
  spec,
  theme,
  stage,
}: {
  scene: Scene;
  spec: VideoSpec;
  theme: VideoTheme;
  stage: Stage;
}) {
  const times = useMemo(
    () => elementTimes(scene, spec.language, spec.voice.speed),
    [scene, spec.language, spec.voice.speed],
  );
  const at = (path: string) => times[path];
  const props = { theme, stage, at };
  switch (scene.template) {
    case "title":
      return <TitleScene content={scene.content} {...props} />;
    case "bullets":
      return <BulletsScene content={scene.content} {...props} />;
    case "flowchart":
      return <FlowchartScene content={scene.content} {...props} />;
    case "comparison":
      return <ComparisonScene content={scene.content} {...props} />;
    default:
      // The other eight templates arrive in F19.
      return <FallbackScene scene={scene} {...props} />;
  }
}

/** Fades and lifts each scene in and out, so cuts don't feel abrupt. */
function SceneFrame({ frames, children }: { frames: number; children: ReactNode }) {
  const frame = useCurrentFrame();
  const enter = interpolate(frame, [0, 8], [0, 1], { extrapolateRight: "clamp" });
  const leave = interpolate(frame, [frames - 8, frames], [1, 0], { extrapolateLeft: "clamp" });
  return (
    <AbsoluteFill
      style={{
        opacity: Math.min(enter, leave),
        transform: `translateY(${(1 - enter) * 30 - (1 - leave) * 30}px)`,
      }}
    >
      {children}
    </AbsoluteFill>
  );
}

/** Music under the whole video, at a quarter of its volume while the narrator speaks. */
function MusicBed({ spec, src }: { spec: VideoSpec; src: string }) {
  const { fps } = useVideoConfig();
  const music = spec.music!;
  const windows: [number, number][] = [];
  let at = 0;
  for (const scene of spec.scenes) {
    const start = at + msToFrame(sceneLeadInMs(scene));
    const last = sceneWords(scene, spec.language, spec.voice.speed).at(-1);
    if (last) windows.push([start, start + msToFrame(last.endMs)]);
    at += sceneFrames(scene, spec);
  }
  return (
    <Html5Audio
      src={src}
      loop
      volume={(f) => {
        const speaking =
          music.duck && windows.some(([a, b]) => f >= a - fps * 0.2 && f <= b + fps * 0.2);
        return speaking ? music.volume * 0.25 : music.volume;
      }}
    />
  );
}

export function Explainer({ spec, assets = {}, checkLayout = false }: ExplainerProps) {
  const theme = videoTheme(spec.theme.palette);
  const stage = stageOf(spec.format);
  const musicSrc = spec.music ? assets[`music:${spec.music.trackId}`] : undefined;
  return (
    <AbsoluteFill style={{ fontFamily: fontFamilies.sans, color: theme.text }}>
      <Background theme={theme} stage={stage} />
      <Series>
        {spec.scenes.map((scene) => {
          const frames = sceneFrames(scene, spec);
          const audio = scene.timing ? assets[scene.timing.narrationAssetId] : undefined;
          return (
            <Series.Sequence
              key={scene.id}
              durationInFrames={frames}
              name={`${scene.id} · ${scene.template}`}
            >
              <SceneFrame frames={frames}>
                <SceneBody scene={scene} spec={spec} theme={theme} stage={stage} />
              </SceneFrame>
              {audio ? (
                <Sequence from={msToFrame(sceneLeadInMs(scene))} name="narration">
                  <Html5Audio src={audio} />
                </Sequence>
              ) : null}
              {spec.theme.captionStyle !== "none" ? (
                <Captions
                  words={sceneWords(scene, spec.language, spec.voice.speed)}
                  offsetMs={sceneLeadInMs(scene)}
                  style={spec.theme.captionStyle}
                  theme={theme}
                  stage={stage}
                />
              ) : null}
            </Series.Sequence>
          );
        })}
      </Series>
      {musicSrc ? <MusicBed spec={spec} src={musicSrc} /> : null}
      {checkLayout ? <LayoutCheck stage={stage} /> : null}
    </AbsoluteFill>
  );
}
