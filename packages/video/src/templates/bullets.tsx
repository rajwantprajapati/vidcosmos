// Bullets (DB §6): a heading and 2-5 items, each sliding in as it's said, the one being talked
// about lit with the accent. One column in every format; rows share the content box's height.
import type { TemplateContent } from "@vidcosmos/spec/video";
import { useAppear, useIsActive, usePulse } from "../anim";
import { fitBox, lineHeightFor, linesFor } from "../fonts";
import { IconTile, Place, Text } from "../parts";
import type { SceneProps } from "../scene-props";
import type { VideoTheme } from "../theme";

type Item = TemplateContent<"bullets">["items"][number];

function Row({
  item,
  index,
  atMs,
  nextAtMs,
  theme,
  height,
  fontSize,
}: {
  item: Item;
  index: number;
  atMs: number | undefined;
  nextAtMs: number | undefined;
  theme: VideoTheme;
  height: number;
  fontSize: number;
}) {
  const shown = useAppear(atMs);
  const pulse = usePulse(atMs, 1.03);
  const active = useIsActive(atMs, nextAtMs);
  const marker = Math.round(height * 0.6);
  return (
    <div
      data-box
      style={{
        minHeight: height,
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        gap: 28,
        padding: `${Math.round(height * 0.14)}px 32px`,
        borderRadius: 30,
        background: theme.panel,
        border: `3px solid ${active ? theme.accent : theme.line}`,
        boxShadow: active ? `0 0 60px ${theme.glow}` : "none",
        opacity: shown,
        transform: `translateX(${(1 - shown) * -120}px) scale(${pulse})`,
      }}
    >
      {item.icon ? (
        <IconTile name={item.icon} size={marker} theme={theme} tone={active ? "accent" : "soft"} />
      ) : (
        <div
          style={{
            width: marker * 0.8,
            height: marker * 0.8,
            borderRadius: marker,
            background: active ? theme.accent : theme.line,
            color: active ? theme.onAccent : theme.text,
            fontSize: marker * 0.42,
            fontWeight: 800,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {index + 1}
        </div>
      )}
      <Text size={fontSize} weight={650} color={theme.text}>
        {item.text}
      </Text>
    </div>
  );
}

export function BulletsScene({ content, theme, stage, at }: SceneProps<"bullets">) {
  const headIn = useAppear(at("headingTrigger"));
  const portrait = stage.orientation === "portrait";
  const count = content.items.length;
  const gap = count > 4 ? 18 : 26;
  const { width, height } = stage.content;
  const headingSize = fitBox(content.heading, portrait ? 72 : 64, 40, width, 180, 1.1);
  const headingRoom =
    linesFor(content.heading, headingSize, width) *
      headingSize *
      lineHeightFor(content.heading, 1.1) +
    14 +
    gap;
  const rowHeight = Math.min(
    portrait ? 150 : 128,
    (height - headingRoom - gap * (count - 1)) / count,
  );
  // The row's text area: less the marker, the gap beside it, the padding and the borders.
  const textWidth = width - rowHeight * 0.6 - 28 - 64 - 6;
  const fontSize = Math.min(
    ...content.items.map((item) =>
      // Two lines at most where a size allows it, so rows keep their padding.
      fitBox(
        item.text,
        count > 4 ? 46 : 52,
        24,
        textWidth,
        rowHeight - 2 * Math.round(rowHeight * 0.14) - 6,
        1.2,
        2,
      ),
    ),
  );

  return (
    <Place box={stage.content} style={{ justifyContent: "center", gap }}>
      <div
        style={{
          marginBottom: 14,
          opacity: headIn,
          transform: `translateY(${(1 - headIn) * 30}px)`,
        }}
      >
        <Text size={headingSize} weight={800} color={theme.text} display lineHeight={1.1}>
          {content.heading}
        </Text>
      </div>
      {content.items.map((item, i) => (
        <Row
          key={i}
          item={item}
          index={i}
          atMs={at(`items[${i}].trigger`)}
          nextAtMs={at(`items[${i + 1}].trigger`)}
          theme={theme}
          height={rowHeight}
          fontSize={fontSize}
        />
      ))}
    </Place>
  );
}
