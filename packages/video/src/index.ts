// @vidcosmos/video: the Remotion composition that draws a video from its spec (SDD §9), with
// its templates, video themes and fonts. The app's Player (F21) and the export render (F26)
// both use `Explainer`; Studio and the stills live in `src/remotion` and `scripts/`.
export { captionPages } from "./captions";
export {
  compositionSize,
  Explainer,
  type ExplainerProps,
  sceneFrames,
  totalFrames,
} from "./explainer";
export { fontFamilies, fontFiles } from "./fonts";
export { stageOf, type Stage, videoFormats } from "./format";
export { palettes, videoTheme, type VideoTheme } from "./theme";
