// Pie chart (DB §6): a heading, a ring of 2-5 slices that sweep in as each label is said, and
// a legend with each slice's colour, label and share (whole percentages adding up to 100), so
// a slice is never told apart by colour alone. The slice being talked about stands out and its
// share sits in the ring's centre; a moment after the last is said, the largest takes over.
// The legend sits below the ring in 9:16 and beside it in 16:9 and 1:1.
import { Easing, interpolate, useCurrentFrame } from "remotion";
import { msToFrame } from "@vidcosmos/spec/video";
import { useAppear } from "../anim";
import { fitBox, textEm } from "../fonts";
import { percentages } from "../numbers";
import { Heading, headingFit, Place, sourceText, Text, textHeight } from "../parts";
import type { SceneProps } from "../scene-props";
import type { VideoTheme } from "../theme";

/** Slice colours: the accent and shades mixed from it and the text, so every palette works. */
export function sliceColours(theme: VideoTheme): string[] {
  const mix = (a: string, percent: number, b: string) =>
    `color-mix(in srgb, ${a} ${percent}%, ${b})`;
  return [
    theme.accent,
    mix(theme.accent, 45, theme.text),
    mix(theme.accent, 50, theme.bg),
    mix(theme.text, 70, theme.bg),
    mix(theme.text, 35, theme.bg),
  ];
}

/** Frames after the last slice is said before the largest one is shown in the centre. */
const settleFrames = 30;

/** The index of the largest value, the first if two are equal. */
export const largestSlice = (values: number[]) => values.indexOf(Math.max(...values));

function useSweep(atMs: number | undefined) {
  const frame = useCurrentFrame();
  return interpolate(frame - msToFrame(atMs ?? 0), [0, 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
}

function Slice({
  start,
  share,
  atMs,
  active,
  colour,
  radius,
  thickness,
  theme,
}: {
  start: number;
  share: number;
  atMs: number | undefined;
  active: boolean;
  colour: string;
  radius: number;
  thickness: number;
  theme: VideoTheme;
}) {
  const sweep = useSweep(atMs);
  const circumference = 2 * Math.PI * radius;
  // A sliver of the background between slices.
  const length = Math.max(0, share * circumference * sweep - (share < 1 ? 6 : 0));
  if (length <= 0) return null;
  return (
    <circle
      r={radius}
      cx={0}
      cy={0}
      fill="none"
      stroke={colour}
      strokeWidth={active ? thickness * 1.14 : thickness}
      strokeDasharray={`${length} ${circumference}`}
      strokeDashoffset={-start * circumference}
      style={{ filter: active ? `drop-shadow(0 0 18px ${theme.glow})` : undefined }}
    />
  );
}

function LegendRow({
  label,
  percent,
  colour,
  atMs,
  active,
  theme,
  sizes,
}: {
  label: string;
  percent: string;
  colour: string;
  atMs: number | undefined;
  active: boolean;
  theme: VideoTheme;
  sizes: { label: number; percent: number; percentWidth: number; swatch: number; pad: number };
}) {
  const shown = useAppear(atMs);
  return (
    <div
      data-box
      style={{
        display: "flex",
        alignItems: "center",
        gap: 20,
        padding: `${sizes.pad}px 24px`,
        borderRadius: 24,
        background: theme.panel,
        border: `3px solid ${active ? theme.accent : theme.line}`,
        opacity: shown,
        transform: `translateX(${(1 - shown) * 60}px)`,
      }}
    >
      <div
        style={{
          width: sizes.swatch,
          height: sizes.swatch,
          borderRadius: sizes.swatch * 0.3,
          background: colour,
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <Text size={sizes.label} weight={600} color={theme.text} lineHeight={1.15}>
          {label}
        </Text>
      </div>
      <div style={{ width: sizes.percentWidth, textAlign: "right", flexShrink: 0 }}>
        <Text
          size={sizes.percent}
          weight={800}
          color={theme.text}
          lineHeight={1.1}
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {percent}
        </Text>
      </div>
    </div>
  );
}

export function PieChartScene({ content, language, theme, stage, at }: SceneProps<"pieChart">) {
  const frame = useCurrentFrame();
  const { width, height } = stage.content;
  const slices = content.slices;
  const n = slices.length;
  const portrait = stage.orientation === "portrait";
  const gap = portrait ? 28 : 24;
  const heading = headingFit(content.heading, width, portrait ? 68 : 60, 160);
  const source = content.source ? sourceText(content.source, language) : null;
  const sourceSize = source ? fitBox(source, 30, 20, width, 80, 1.2) : 0;
  const sourceHeight = source ? textHeight(source, sourceSize, width, 1.2) + gap : 0;
  const avail = height - heading.height - gap - sourceHeight;
  const shares = percentages(slices.map((s) => s.value));
  const colours = sliceColours(theme);
  const atOf = (i: number) => at(`slices[${i}].trigger`);

  // The ring, and the legend's box beside or below it.
  const legendGap = portrait ? 32 : 56;
  const ring = portrait
    ? Math.min(width * 0.72, avail * 0.42)
    : Math.min(avail, (width - legendGap) * 0.46);
  const legendWidth = portrait ? width : width - ring - legendGap;
  const legendHeight = portrait ? avail - ring - legendGap : avail;
  const rowGap = n > 3 ? 12 : 18;
  const row = Math.min(110, (legendHeight - rowGap * (n - 1)) / n);
  const pad = Math.max(8, Math.min(16, Math.round(row * 0.12)));
  const swatch = Math.round(Math.min(36, row * 0.4));
  const percent = Math.min(44, Math.round(row * 0.42));
  // "100%" with room to spare: bold digits run wider than the estimate.
  const percentWidth = textEm("100%") * percent * 1.25;
  const labelWidth = legendWidth - 2 * 24 - 6 - swatch - percentWidth - 2 * 20;
  const label = Math.min(
    ...slices.map((s) => fitBox(s.label, 40, 20, labelWidth, row - 2 * pad - 6, 1.15, 2)),
  );

  // The slice being talked about: the last one said so far. A moment after the last one,
  // the largest takes over, so the chart settles on its main point rather than its smallest
  // slice.
  let current = -1;
  slices.forEach((_, i) => {
    if (frame >= msToFrame(atOf(i) ?? 0)) current = i;
  });
  if (current === n - 1 && frame >= msToFrame(atOf(n - 1) ?? 0) + settleFrames) {
    current = largestSlice(slices.map((s) => s.value));
  }
  const centreIn = useAppear(atOf(0));
  const thickness = ring * 0.2;
  const radius = ring / 2 - thickness * 0.6;
  let start = 0;
  const arcs = slices.map((slice, i) => {
    const share = slice.value / slices.reduce((sum, s) => sum + s.value, 0);
    const arc = { start, share, i };
    start += share;
    return arc;
  });
  const centre = current >= 0 ? `${shares[current]}%` : "";
  const centreSize = Math.round(ring * 0.17);

  return (
    <Place box={stage.content} style={{ justifyContent: "center", gap }}>
      <Heading
        text={content.heading}
        size={heading.size}
        atMs={at("headingTrigger")}
        theme={theme}
      />
      <div
        style={{
          display: "flex",
          flexDirection: portrait ? "column" : "row",
          alignItems: "center",
          gap: legendGap,
        }}
      >
        <div style={{ width: ring, height: ring, position: "relative", flexShrink: 0 }}>
          <svg
            width={ring}
            height={ring}
            viewBox={`${-ring / 2} ${-ring / 2} ${ring} ${ring}`}
            style={{ transform: "rotate(-90deg)", overflow: "visible" }}
          >
            <circle r={radius} fill="none" stroke={theme.line} strokeWidth={thickness} />
            {arcs.map(({ start, share, i }) => (
              <Slice
                key={i}
                start={start}
                share={share}
                atMs={atOf(i)}
                active={i === current}
                colour={colours[i]!}
                radius={radius}
                thickness={thickness}
                theme={theme}
              />
            ))}
          </svg>
          {centre ? (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                opacity: centreIn,
              }}
            >
              <Text
                size={centreSize}
                weight={800}
                color={theme.text}
                display
                lineHeight={1}
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {centre}
              </Text>
            </div>
          ) : null}
        </div>
        <div
          style={{
            width: legendWidth,
            display: "flex",
            flexDirection: "column",
            gap: rowGap,
          }}
        >
          {slices.map((slice, i) => (
            <LegendRow
              key={i}
              label={slice.label}
              percent={`${shares[i]}%`}
              colour={colours[i]!}
              atMs={atOf(i)}
              active={i === current}
              theme={theme}
              sizes={{ label, percent, percentWidth, swatch, pad }}
            />
          ))}
        </div>
      </div>
      {source ? (
        <Text size={sourceSize} weight={500} color={theme.muted}>
          {source}
        </Text>
      ) : null}
    </Place>
  );
}
