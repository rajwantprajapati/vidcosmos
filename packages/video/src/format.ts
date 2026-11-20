// The canvas for each format (DB §6 "Formats"), in px at 1080p, with the safe area kept clear
// of text (Instagram's and Shorts' buttons in 9:16), and the box templates lay out in: the safe
// area less the band captions use at its bottom, so captions never cover the scene.
import { formats, type VideoSpec } from "@vidcosmos/spec/video";

export type VideoFormat = VideoSpec["format"];
export const videoFormats: VideoFormat[] = ["9:16", "16:9", "1:1"];

export type Box = { left: number; top: number; width: number; height: number };

export type Stage = {
  format: VideoFormat;
  width: number;
  height: number;
  /** Where text may go. */
  safe: Box;
  /** Where a template's content goes: the safe area above the captions. */
  content: Box;
  /** Where captions sit: the bottom of the safe area. */
  captions: Box;
  orientation: "portrait" | "landscape" | "square";
};

/** Room for two caption lines, at the bottom of the safe area. */
const captionBand = { portrait: 250, landscape: 190, square: 190 } as const;

export function stageOf(format: VideoFormat): Stage {
  const info = formats[format];
  const { width, height } = info;
  const orientation = format === "9:16" ? "portrait" : format === "16:9" ? "landscape" : "square";
  const safe: Box = {
    left: Math.round(width * info.safe.left),
    top: Math.round(height * info.safe.top),
    width: Math.round(width * (1 - info.safe.left - info.safe.right)),
    height: Math.round(height * (1 - info.safe.top - info.safe.bottom)),
  };
  const band = captionBand[orientation];
  return {
    format,
    width,
    height,
    safe,
    content: { ...safe, height: safe.height - band },
    captions: { ...safe, top: safe.top + safe.height - band, height: band },
    orientation,
  };
}
