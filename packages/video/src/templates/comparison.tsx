// Comparison (DB §6): two sides, each a title (and icon) with 1-4 points, with "VS" between.
// The sides stack in 9:16 and sit side by side in 16:9 and 1:1. The left side is filled with
// the accent, the right is outlined in it, so they read as two without a second accent colour.
import type { TemplateContent } from "@vidcosmos/spec/video";
import { useAppear, usePulse } from "../anim";
import { fitBox, lineHeightFor, linesFor } from "../fonts";
import { Icon, Place, Text } from "../parts";
import type { SceneProps } from "../scene-props";
import type { VideoTheme } from "../theme";

type Side = TemplateContent<"comparison">["left"];

/** Sizes for one side, worked out so both sides fit the content box. */
type Sizes = {
  title: number;
  titlePad: number;
  point: number;
  pointPad: number;
  gap: number;
  icon: number;
};

function Point({
  text,
  atMs,
  theme,
  sizes,
}: {
  text: string;
  atMs: number | undefined;
  theme: VideoTheme;
  sizes: Sizes;
}) {
  const shown = useAppear(atMs);
  return (
    <div
      data-box
      style={{
        borderRadius: 22,
        padding: `${sizes.pointPad}px 22px`,
        background: theme.panel,
        borderLeft: `10px solid ${theme.accent}`,
        opacity: shown,
        transform: `translateY(${(1 - shown) * 40}px)`,
      }}
    >
      <Text size={sizes.point} weight={600} color={theme.text}>
        {text}
      </Text>
    </div>
  );
}

function Column({
  side,
  name,
  theme,
  at,
  sizes,
}: {
  side: Side;
  name: "left" | "right";
  theme: VideoTheme;
  at: (path: string) => number | undefined;
  sizes: Sizes;
}) {
  const titleAt = at(`${name}.titleTrigger`);
  const shown = useAppear(titleAt);
  const pulse = usePulse(titleAt, 1.05);
  const filled = name === "left";
  const dir = name === "left" ? -1 : 1;
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: sizes.gap, minWidth: 0 }}>
      <div
        data-box
        style={{
          borderRadius: 28,
          padding: `${sizes.titlePad}px 24px`,
          boxSizing: "border-box",
          background: filled ? theme.accent : theme.panel,
          border: `4px solid ${theme.accent}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 18,
          opacity: shown,
          transform: `translateX(${(1 - shown) * 140 * dir}px) scale(${pulse})`,
          textAlign: "center",
        }}
      >
        {side.icon ? (
          <Icon
            name={side.icon}
            size={sizes.icon}
            color={filled ? theme.onAccent : theme.accent}
            strokeWidth={2.3}
          />
        ) : null}
        <Text
          size={sizes.title}
          weight={800}
          color={filled ? theme.onAccent : theme.text}
          display
          lineHeight={1.1}
        >
          {side.title}
        </Text>
      </div>
      {side.points.map((point, i) => (
        <Point
          key={i}
          text={point.text}
          atMs={at(`${name}.points[${i}].trigger`)}
          theme={theme}
          sizes={sizes}
        />
      ))}
    </div>
  );
}

const vsSize = 84;

export function ComparisonScene({ content, theme, stage, at }: SceneProps<"comparison">) {
  const headIn = useAppear(at("headingTrigger"));
  const vsIn = useAppear(at("right.titleTrigger"), { damping: 10 });
  const stacked = stage.orientation === "portrait";
  const { width, height } = stage.content;
  const outerGap = stacked ? 18 : 28;
  const headingSize = fitBox(content.heading, 56, 36, width, 140, 1.1);
  const headingHeight =
    linesFor(content.heading, headingSize, width) *
    headingSize *
    lineHeightFor(content.heading, 1.1);
  // Each side's column: the full width when stacked, half beside "VS" otherwise.
  const column = stacked ? width : (width - vsSize - 2 * 28) / 2;
  const sideHeight = stacked
    ? (height - headingHeight - 3 * outerGap - vsSize) / 2
    : height - headingHeight - outerGap;
  const sides = [content.left, content.right];
  const icon = sides.some((side) => side.icon) ? 52 : 0;
  const titleWidth = column - 2 * 24 - 8 - (icon ? icon + 18 : 0);
  const title = Math.min(
    ...sides.map((side) =>
      fitBox(side.title, stacked ? 40 : 48, 26, titleWidth, 2 * 48 * 1.1, 1.1),
    ),
  );
  const titleLines = Math.max(...sides.map((side) => linesFor(side.title, title, titleWidth)));
  const titlePad = stacked ? 12 : 16;
  const titleHeight = Math.max(icon, titleLines * title * 1.4) + 2 * titlePad + 8;
  const count = Math.max(...sides.map((side) => side.points.length));
  const gap = count > 2 ? (stacked ? 8 : 10) : 16;
  const pointPad = stacked ? 8 : 12;
  const pointHeight = (sideHeight - titleHeight - gap * count) / count;
  const pointWidth = column - 22 * 2 - 10;
  const point = Math.min(
    ...sides.flatMap((side) =>
      side.points.map((p) => fitBox(p.text, 34, 22, pointWidth, pointHeight - 2 * pointPad, 1.2)),
    ),
  );
  const sizes: Sizes = { title, titlePad, point, pointPad, gap, icon: icon || 52 };

  const vs = (
    <div
      style={{
        alignSelf: "center",
        width: vsSize,
        height: vsSize,
        flexShrink: 0,
        borderRadius: vsSize / 2,
        background: theme.text,
        color: theme.bg,
        fontSize: 32,
        fontWeight: 800,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transform: `scale(${vsIn})`,
      }}
    >
      VS
    </div>
  );
  return (
    <Place box={stage.content} style={{ justifyContent: "center", gap: outerGap }}>
      <div style={{ opacity: headIn, transform: `translateY(${(1 - headIn) * 30}px)` }}>
        <Text size={headingSize} weight={800} color={theme.text} display lineHeight={1.1}>
          {content.heading}
        </Text>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: stacked ? "column" : "row",
          gap: stacked ? outerGap : 28,
          alignItems: stacked ? "stretch" : "flex-start",
          minHeight: 0,
        }}
      >
        <Column side={content.left} name="left" theme={theme} at={at} sizes={sizes} />
        {stacked ? (
          vs
        ) : (
          <div style={{ alignSelf: "flex-start", marginTop: titleHeight / 2 - vsSize / 2 }}>
            {vs}
          </div>
        )}
        <Column side={content.right} name="right" theme={theme} at={at} sizes={sizes} />
      </div>
    </Place>
  );
}
