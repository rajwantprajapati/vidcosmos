// The design system's fonts (design/design-system/fonts), so the video reads as the app does:
// Plus Jakarta Sans for headings, Inter for everything else, Noto Sans Devanagari for Hindi.
// Studio and the renderer load them from the files; the app's Player uses the page's own.
export const fontFamilies = {
  display: '"Plus Jakarta Sans", "Noto Sans Devanagari", Inter, sans-serif',
  sans: 'Inter, "Noto Sans Devanagari", sans-serif',
} as const;

/** Every font file the video uses: family, weight and file name. */
export const fontFiles: { family: string; weight: string; file: string }[] = [
  { family: "Plus Jakarta Sans", weight: "700", file: "PlusJakartaSans-700.woff2" },
  { family: "Plus Jakarta Sans", weight: "800", file: "PlusJakartaSans-800.woff2" },
  { family: "Inter", weight: "500", file: "Inter-500.woff2" },
  { family: "Inter", weight: "600", file: "Inter-600.woff2" },
  { family: "Inter", weight: "700", file: "Inter-700.woff2" },
  { family: "Noto Sans Devanagari", weight: "500", file: "NotoSansDevanagari-500.woff2" },
  { family: "Noto Sans Devanagari", weight: "700", file: "NotoSansDevanagari-700.woff2" },
];

/** Loads every font from `urlOf(file)` and resolves once they're ready (or failed). */
export async function loadFonts(urlOf: (file: string) => string): Promise<void> {
  await Promise.all(
    fontFiles.map(async ({ family, weight, file }) => {
      const face = new FontFace(family, `url(${urlOf(file)}) format("woff2")`, { weight });
      document.fonts.add(await face.load());
    }),
  );
}

/** Devanagari needs more line height for its matras. */
export const lineHeightFor = (text: string, latin: number) =>
  /[ऀ-ॿ]/.test(text) ? latin + 0.3 : latin;

/**
 * A font size that keeps longer text inside its box: `base` up to `comfortable` characters,
 * then smaller with the square root of the length, never below `min`.
 */
export function fitFontSize(text: string, base: number, comfortable: number, min: number) {
  if (text.length <= comfortable) return base;
  return Math.max(min, Math.round(base * Math.sqrt(comfortable / text.length)));
}

/**
 * About how wide a character is, in em, at the weights the video uses: capitals and wide
 * letters take more room than lower case, so text in capitals isn't under-estimated.
 * Devanagari is counted per code unit, so its marks pad the estimate a little.
 */
export function charEm(ch: string): number {
  if (/\s/.test(ch)) return 0.28;
  if (/[\u0900-\u097F]/.test(ch)) return 0.6;
  if (/[MWmw@%]/.test(ch)) return 0.9;
  if (/[A-Z]/.test(ch)) return 0.72;
  if (/[0-9]/.test(ch)) return 0.62;
  if (/[iljtfr.,;:'’!|()]/.test(ch)) return 0.34;
  if (/[a-z]/.test(ch)) return 0.56;
  return 0.65;
}

/** About how wide `text` is, in em. */
export const textEm = (text: string) => [...text].reduce((sum, ch) => sum + charEm(ch), 0);

/** The widest single word, in em: it can't wrap, so it must fit on a line by itself. */
export const longestWordEm = (text: string) => Math.max(0, ...text.split(/\s+/).map(textEm));

/**
 * About how many lines `text` takes at `size` px in a box `width` px wide, wrapping between
 * words as the browser does. A word wider than the box counts the lines it would break into.
 */
export function linesFor(text: string, size: number, width: number): number {
  const room = Math.max(1, width);
  const space = charEm(" ") * size;
  let lines = 1;
  let used = 0;
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const w = textEm(word) * size;
    if (w > room) {
      // Broken across lines (the last resort, overflowWrap).
      lines += used > 0 ? Math.ceil(w / room) : Math.ceil(w / room) - 1;
      used = w % room;
      continue;
    }
    if (used > 0 && used + space + w > room) {
      lines += 1;
      used = w;
    } else {
      used += (used > 0 ? space : 0) + w;
    }
  }
  return lines;
}

/**
 * The largest font size from `max` down to `min` at which `text`, wrapped to `width`, fits in
 * `height` (its lines times the line height) with its longest word whole on a line. `min` if
 * nothing larger fits: then a word may break, as a last resort.
 */
export function fitBox(
  text: string,
  max: number,
  min: number,
  width: number,
  height: number,
  lineHeight: number,
  /** Prefer at most this many lines; if no size allows it, any number that fits. */
  maxLines = Number.POSITIVE_INFINITY,
): number {
  const lh = lineHeightFor(text, lineHeight);
  const word = longestWordEm(text);
  for (let size = Math.floor(max); size > min; size--) {
    const lines = linesFor(text, size, width);
    if (word * size <= width && lines <= maxLines && lines * size * lh <= height) return size;
  }
  return Number.isFinite(maxLines) ? fitBox(text, max, min, width, height, lineHeight) : min;
}
