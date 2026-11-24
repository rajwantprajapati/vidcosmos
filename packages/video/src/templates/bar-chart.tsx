// Bar chart (DB §6): a heading and 2-6 bars, each growing from zero as its label is said, with
// its value (in lakh and crore, and the unit) at its end; the bar being talked about is lit,
// and the source sits below. Bars run across in 9:16 and 1:1, where labels need the width, and
// stand up as columns in 16:9. Bars share one scale: the largest value.
import { Easing, interpolate, useCurrentFrame } from "remotion";
import { msToFrame, type TemplateContent } from "@vidcosmos/spec/video";
import { useIsActive } from "../anim";
import { fitBox, textEm } from "../fonts";
import { formatValue } from "../numbers";
import { Heading, headingFit, Place, sourceText, Text, textHeight } from "../parts";
import type { SceneProps } from "../scene-props";
import type { VideoTheme } from "../theme";

type Bar = TemplateContent<"barChart">["bars"][number];

/** 0 → 1 as a bar grows, from the moment its label is said. */
function useGrow(atMs: number | undefined) {
  const frame = useCurrentFrame();
  return interpolate(frame - msToFrame(atMs ?? 0), [0, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
}

const fill = (theme: VideoTheme, active: boolean) =>
  active ? theme.accent : `color-mix(in srgb, ${theme.accent} 62%, ${theme.bg})`;

type Timed = { bar: Bar; value: string; atMs: number | undefined; nextAtMs: number | undefined };

function Across({
  item,
  share,
  theme,
  sizes,
}: {
  item: Timed;
  share: number;
  theme: VideoTheme;
  sizes: { label: number; bar: number; value: number; track: number };
}) {
  const grow = useGrow(item.atMs);
  const active = useIsActive(item.atMs, item.nextAtMs);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, opacity: grow > 0 ? 1 : 0 }}>
      <Text size={sizes.label} weight={600} color={theme.text} lineHeight={1.15}>
        {item.bar.label}
      </Text>
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <div
          style={{
            // A zero gets no bar, only its value; any other value at least a stub.
            width: share > 0 ? Math.max(sizes.bar / 2, sizes.track * share * grow) : 0,
            height: sizes.bar,
            borderRadius: sizes.bar / 2,
            background: fill(theme, active),
            boxShadow: active ? `0 0 40px ${theme.glow}` : "none",
            flexShrink: 0,
          }}
        />
        <div style={{ opacity: interpolate(grow, [0.5, 1], [0, 1], { extrapolateLeft: "clamp" }) }}>
          <Text
            size={sizes.value}
            weight={800}
            color={theme.text}
            lineHeight={1.1}
            style={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}
          >
            {item.value}
          </Text>
        </div>
      </div>
    </div>
  );
}

function Upright({
  item,
  share,
  theme,
  sizes,
}: {
  item: Timed;
  share: number;
  theme: VideoTheme;
  sizes: { cell: number; bar: number; track: number; value: number; label: number; labels: number };
}) {
  const grow = useGrow(item.atMs);
  const active = useIsActive(item.atMs, item.nextAtMs);
  return (
    <div
      style={{
        width: sizes.cell,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: 12,
        opacity: grow > 0 ? 1 : 0,
      }}
    >
      <div
        style={{
          textAlign: "center",
          opacity: interpolate(grow, [0.5, 1], [0, 1], { extrapolateLeft: "clamp" }),
        }}
      >
        <Text
          size={sizes.value}
          weight={800}
          color={theme.text}
          lineHeight={1.1}
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {item.value}
        </Text>
      </div>
      <div
        style={{
          width: sizes.bar,
          height: share > 0 ? Math.max(sizes.bar / 4, sizes.track * share * grow) : 0,
          borderRadius: `${sizes.bar / 4}px ${sizes.bar / 4}px 0 0`,
          background: fill(theme, active),
          boxShadow: active ? `0 0 40px ${theme.glow}` : "none",
        }}
      />
      <div style={{ height: sizes.labels, width: sizes.cell - 12, textAlign: "center" }}>
        <Text size={sizes.label} weight={600} color={theme.text} lineHeight={1.15}>
          {item.bar.label}
        </Text>
      </div>
    </div>
  );
}

export function BarChartScene({ content, language, theme, stage, at }: SceneProps<"barChart">) {
  const { width, height } = stage.content;
  const bars = content.bars;
  const n = bars.length;
  const portrait = stage.orientation === "portrait";
  const gap = n > 4 ? 16 : 26;
  const heading = headingFit(content.heading, width, portrait ? 68 : 60, 160);
  const source = content.source ? sourceText(content.source, language) : null;
  const sourceSize = source ? fitBox(source, 30, 20, width, 80, 1.2) : 0;
  const sourceHeight = source ? textHeight(source, sourceSize, width, 1.2) + gap : 0;
  const avail = height - heading.height - gap * 2 - sourceHeight;
  const max = Math.max(...bars.map((bar) => bar.value));
  const items: Timed[] = bars.map((bar, i) => ({
    bar,
    value: formatValue(bar.value, language, content.unit),
    atMs: at(`bars[${i}].trigger`),
    nextAtMs: at(`bars[${i + 1}].trigger`),
  }));
  const shareOf = (bar: Bar) => (max > 0 ? bar.value / max : 0);

  let chart;
  if (stage.orientation === "landscape") {
    const columnGap = 24;
    const cell = (width - columnGap * (n - 1)) / n;
    const label = Math.min(...bars.map((b) => fitBox(b.label, 34, 20, cell - 12, 90, 1.15, 2)));
    const labels = Math.max(...bars.map((b) => textHeight(b.label, label, cell - 12, 1.15)));
    const value = Math.min(...items.map((t) => fitBox(t.value, 40, 22, cell, 100, 1.1, 2)));
    const valueHeight = Math.max(...items.map((t) => textHeight(t.value, value, cell, 1.1)));
    const track = avail - labels - valueHeight - 2 * 12;
    chart = (
      <div style={{ display: "flex", gap: columnGap, alignItems: "flex-end", height: avail }}>
        {items.map((item, i) => (
          <Upright
            key={i}
            item={item}
            share={shareOf(item.bar)}
            theme={theme}
            sizes={{ cell, bar: Math.min(cell * 0.62, 170), track, value, label, labels }}
          />
        ))}
      </div>
    );
  } else {
    const row = (avail - gap * (n - 1)) / n;
    const label = Math.min(
      ...bars.map((b) => fitBox(b.label, portrait ? 40 : 34, 20, width, row * 0.45, 1.15, 1)),
    );
    const labelHeight = Math.max(...bars.map((b) => textHeight(b.label, label, width, 1.15)));
    const bar = Math.max(20, Math.min(56, row - labelHeight - 8));
    // The value sits after the bar on one line, so the widest value sets the bars' room.
    const widest = Math.max(...items.map((t) => textEm(t.value)));
    const value = Math.max(20, Math.min(bar * 0.8, 44, (width * 0.42) / widest));
    const track = width - widest * value - 18 - 4;
    chart = (
      <div style={{ display: "flex", flexDirection: "column", gap }}>
        {items.map((item, i) => (
          <Across
            key={i}
            item={item}
            share={shareOf(item.bar)}
            theme={theme}
            sizes={{ label, bar, value, track }}
          />
        ))}
      </div>
    );
  }

  return (
    <Place box={stage.content} style={{ justifyContent: "center", gap }}>
      <Heading
        text={content.heading}
        size={heading.size}
        atMs={at("headingTrigger")}
        theme={theme}
        style={{ marginBottom: gap }}
      />
      {chart}
      {source ? (
        <Text size={sourceSize} weight={500} color={theme.muted}>
          {source}
        </Text>
      ) : null}
    </Place>
  );
}
