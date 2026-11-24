// Captions (PRD FR-5.7): the narration in lines of at most 32 characters, two lines at a time,
// in sync with the words. "highlight" marks the word being said (the video theme's highlight,
// dark text on it); "classic" shows the lines plainly; "none" shows nothing.
import { Fragment } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import type { SpokenWord } from "@vidcosmos/spec/video";
import { fontFamilies, lineHeightFor } from "./fonts";
import type { Stage } from "./format";
import type { VideoTheme } from "./theme";

export const captionLimits = { lineChars: 32, lines: 2 } as const;

export type CaptionPage = { lines: SpokenWord[][]; startMs: number; endMs: number };

/**
 * The words in pages of up to two lines of 32 characters. A page also ends after a sentence,
 * so captions don't run one sentence into the next.
 */
export function captionPages(words: SpokenWord[]): CaptionPage[] {
  const pages: CaptionPage[] = [];
  let lines: SpokenWord[][] = [[]];
  const length = (line: SpokenWord[]) =>
    line.reduce((sum, w, i) => sum + w.text.length + (i ? 1 : 0), 0);
  const flush = () => {
    const filled = lines.filter((line) => line.length > 0);
    if (filled.length > 0) {
      pages.push({
        lines: filled,
        startMs: filled[0]![0]!.startMs,
        endMs: filled.at(-1)!.at(-1)!.endMs,
      });
    }
    lines = [[]];
  };
  for (const word of words) {
    let line = lines.at(-1)!;
    if (line.length > 0 && length(line) + 1 + word.text.length > captionLimits.lineChars) {
      if (lines.length >= captionLimits.lines) flush();
      else lines.push([]);
      line = lines.at(-1)!;
    }
    line.push(word);
    if (/[.!?।]["”’)]*$/.test(word.text)) flush();
  }
  flush();
  return pages;
}

export function Captions({
  words,
  offsetMs,
  style,
  theme,
  stage,
}: {
  words: SpokenWord[];
  /** Where the narration starts in the scene (its lead-in). */
  offsetMs: number;
  style: "highlight" | "classic";
  theme: VideoTheme;
  stage: Stage;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const now = (frame / fps) * 1000 - offsetMs;
  const pages = captionPages(words);
  const page = pages.find(
    (p, i) => now >= p.startMs - 80 && now < (pages[i + 1]?.startMs ?? p.endMs + 500) - 80,
  );
  if (!page) return null;
  const size = stage.orientation === "portrait" ? 48 : 42;
  // The word being said: the last one that has started (a little early, as the eye leads).
  const current = page.lines
    .flat()
    .findLast((word) => now >= word.startMs - 40 && now < word.endMs + 250);
  const text = page.lines
    .flat()
    .map((w) => w.text)
    .join(" ");
  return (
    <div
      style={{
        position: "absolute",
        ...stage.captions,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        paddingBottom: 12,
        boxSizing: "border-box",
      }}
    >
      <div
        data-text={text}
        data-area="captions"
        style={{
          maxWidth: "100%",
          background: theme.captionBg,
          borderRadius: 26,
          padding: "14px 28px",
          fontFamily: fontFamilies.sans,
          fontSize: size,
          fontWeight: 700,
          lineHeight: lineHeightFor(text, 1.25),
          color: theme.light ? theme.panel : theme.text,
          textAlign: "center",
        }}
      >
        {page.lines.map((line, i) => (
          <div key={i}>
            {line.map((word, j) => {
              const speaking = style === "highlight" && word === current;
              return (
                <Fragment key={j}>
                  {j > 0 ? " " : null}
                  <span
                    // Marks the word being said, for the editor's tests (F21).
                    data-spoken={speaking || undefined}
                    style={{
                      // Padding the highlight without moving the words.
                      padding: "0 6px",
                      margin: "0 -6px",
                      borderRadius: 10,
                      background: speaking ? theme.highlight : "transparent",
                      color: speaking ? theme.onHighlight : undefined,
                    }}
                  >
                    {word.text}
                  </span>
                </Fragment>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
