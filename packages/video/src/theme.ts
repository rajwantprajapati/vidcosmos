// The four video themes (PRD FR-4.6): midnight, paper, ocean and sunset. Each palette's five
// colours come from the design tokens (`video-<palette>-bg|panel|text|accent|highlight`);
// softer shades are mixed from them, so no colour is written here. They colour the video only,
// never the app.
import { designTokens } from "@vidcosmos/config/tokens";
import type { VideoSpec } from "@vidcosmos/spec/video";

export type Palette = VideoSpec["theme"]["palette"];
export const palettes: Palette[] = ["midnight", "paper", "ocean", "sunset"];

export type VideoTheme = {
  bg: string;
  panel: string;
  text: string;
  accent: string;
  /** The spoken word in captions, with `onHighlight` text on it. */
  highlight: string;
  onHighlight: string;
  /** Text and icons on an accent fill. */
  onAccent: string;
  /** Secondary text: subheadings, sources. */
  muted: string;
  /** Hairlines and resting borders. */
  line: string;
  /** A soft glow behind the active element and in the background. */
  glow: string;
  /** Behind captions, so they read on any scene. */
  captionBg: string;
  light: boolean;
};

const token = (name: string): string => {
  const found = designTokens.color.tokens.find((t) => t.name === name);
  if (!found || typeof found.value !== "string") {
    throw new Error(`tokens.json has no video colour "${name}".`);
  }
  return found.value;
};

const mix = (color: string, percent: number, other = "transparent") =>
  `color-mix(in srgb, ${color} ${percent}%, ${other})`;

/** Paper is the one light theme: dark text, and white on its accent. */
const lightPalettes = new Set<Palette>(["paper"]);

export function videoTheme(palette: Palette): VideoTheme {
  const part = (name: string) => token(`video-${palette}-${name}`);
  const bg = part("bg");
  const panel = part("panel");
  const text = part("text");
  const accent = part("accent");
  const highlight = part("highlight");
  const light = lightPalettes.has(palette);
  return {
    bg,
    panel,
    text,
    accent,
    highlight,
    onHighlight: light ? text : bg,
    onAccent: light ? panel : bg,
    muted: mix(text, 72, bg),
    line: mix(text, light ? 14 : 18),
    glow: mix(accent, light ? 18 : 34),
    captionBg: light ? mix(text, 86) : mix(bg, 78),
    light,
  };
}
