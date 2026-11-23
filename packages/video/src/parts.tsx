// Pieces the templates share: Lucide icons by name (the closed list in @vidcosmos/spec),
// rounded icon tiles, and text boxes. Every text box carries `data-text`, so the layout check
// can find it and confirm it stays inside the safe area and its own box.
import * as Lucide from "lucide-react";
import type { CSSProperties, ComponentType, ReactNode } from "react";
import type { IconName } from "@vidcosmos/spec/video";
import { useAppear } from "./anim";
import { fitBox, fontFamilies, lineHeightFor, linesFor } from "./fonts";
import type { VideoTheme } from "./theme";

type LucideIcon = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

/** The Lucide component for an icon name, or undefined if Lucide has no such icon. */
export const lucideIcon = (name: IconName): LucideIcon | undefined =>
  (Lucide as unknown as Record<string, LucideIcon | undefined>)[name];

export function Icon({
  name,
  size,
  color,
  strokeWidth = 2,
}: {
  name: IconName | undefined;
  size: number;
  color: string;
  strokeWidth?: number;
}) {
  if (!name) return null;
  const Glyph = lucideIcon(name);
  return Glyph ? <Glyph size={size} color={color} strokeWidth={strokeWidth} /> : null;
}

/** A rounded square holding an icon: filled with the accent, or soft on the panel. */
export function IconTile({
  name,
  size,
  theme,
  tone = "accent",
}: {
  name: IconName | undefined;
  size: number;
  theme: VideoTheme;
  tone?: "accent" | "soft";
}) {
  if (!name) return null;
  const soft = tone === "soft";
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        background: soft ? theme.panel : theme.accent,
        border: soft ? `3px solid ${theme.line}` : "none",
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <Icon
        name={name}
        size={size * 0.55}
        color={soft ? theme.accent : theme.onAccent}
        strokeWidth={2.2}
      />
    </div>
  );
}

/** A block of on-screen text. `display` uses the heading font. */
export function Text({
  children,
  size,
  weight = 600,
  color,
  display = false,
  lineHeight = 1.2,
  style,
}: {
  children: string;
  size: number;
  weight?: number;
  color: string;
  display?: boolean;
  lineHeight?: number;
  style?: CSSProperties;
}) {
  return (
    <div
      data-text={children}
      style={{
        fontFamily: display ? fontFamilies.display : fontFamilies.sans,
        fontSize: size,
        fontWeight: weight,
        color,
        lineHeight: lineHeightFor(children, lineHeight),
        letterSpacing: display ? "-0.02em" : undefined,
        overflowWrap: "break-word",
        minWidth: 0,
        // In a centred column a block is only as wide as its text; this keeps it to the card,
        // so a long word wraps (or, last, breaks) inside it rather than spilling out.
        maxWidth: "100%",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** Positions children in a box of the stage, in px. */
export function Place({
  box,
  children,
  style,
}: {
  box: { left: number; top: number; width: number; height: number };
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{ position: "absolute", ...box, display: "flex", flexDirection: "column", ...style }}
    >
      {children}
    </div>
  );
}

/** How tall `text` is at `size` px, wrapped to `width`: its lines times the line height. */
export const textHeight = (text: string, size: number, width: number, lineHeight: number) =>
  linesFor(text, size, width) * size * lineHeightFor(text, lineHeight);

/** A scene heading's size, up to `max` px and `maxHeight` tall, and the height it takes. */
export function headingFit(text: string, width: number, max: number, maxHeight = 180) {
  const size = fitBox(text, max, 36, width, maxHeight, 1.1);
  return { size, height: textHeight(text, size, width, 1.1) };
}

/** A scene's heading, rising in as it's said (or there from the start, without a trigger). */
export function Heading({
  text,
  size,
  atMs,
  theme,
  style,
}: {
  text: string;
  size: number;
  atMs: number | undefined;
  theme: VideoTheme;
  style?: CSSProperties;
}) {
  const shown = useAppear(atMs);
  return (
    <div style={{ opacity: shown, transform: `translateY(${(1 - shown) * 30}px)`, ...style }}>
      <Text size={size} weight={800} color={theme.text} display lineHeight={1.1}>
        {text}
      </Text>
    </div>
  );
}

/** "Source: …" under a chart or stat, in the video's language. */
export const sourceText = (source: string, language: "en" | "hi") =>
  `${language === "hi" ? "स्रोत" : "Source"}: ${source}`;
