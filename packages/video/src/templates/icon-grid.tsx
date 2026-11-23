// Icon grid (DB §6): a heading and 4-6 cards, each an icon over its label, popping in as it's
// said; the card being talked about is lit. Two columns in 9:16; in 16:9 four or three a row;
// in 1:1 two for four items and three for more. A short last row is centred.
import type { TemplateContent } from "@vidcosmos/spec/video";
import { useAppear, useIsActive, usePulse } from "../anim";
import type { VideoFormat } from "../format";
import { fitBox } from "../fonts";
import { Heading, headingFit, IconTile, Place, Text } from "../parts";
import type { SceneProps } from "../scene-props";
import type { VideoTheme } from "../theme";

type Item = TemplateContent<"iconGrid">["items"][number];

/** Columns for `n` items in a format. */
export function gridColumns(n: number, format: VideoFormat): number {
  if (format === "9:16") return 2;
  if (format === "16:9") return n <= 4 ? n : 3;
  return n === 4 ? 2 : 3;
}

const pad = { x: 24, y: 22 };

function Cell({
  item,
  atMs,
  nextAtMs,
  theme,
  sizes,
}: {
  item: Item;
  atMs: number | undefined;
  nextAtMs: number | undefined;
  theme: VideoTheme;
  sizes: { width: number; height: number; icon: number; label: number; gap: number };
}) {
  const shown = useAppear(atMs, { damping: 12 });
  const pulse = usePulse(atMs, 1.05);
  const active = useIsActive(atMs, nextAtMs);
  return (
    <div
      data-box
      style={{
        width: sizes.width,
        minHeight: sizes.height,
        boxSizing: "border-box",
        padding: `${pad.y}px ${pad.x}px`,
        borderRadius: 30,
        background: theme.panel,
        border: `3px solid ${active ? theme.accent : theme.line}`,
        boxShadow: active ? `0 0 60px ${theme.glow}` : "none",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: sizes.gap,
        textAlign: "center",
        opacity: shown,
        transform: `scale(${(0.6 + 0.4 * shown) * pulse})`,
      }}
    >
      <IconTile
        name={item.icon}
        size={sizes.icon}
        theme={theme}
        tone={active ? "accent" : "soft"}
      />
      <Text size={sizes.label} weight={700} color={theme.text} lineHeight={1.15}>
        {item.label}
      </Text>
    </div>
  );
}

export function IconGridScene({ content, theme, stage, at }: SceneProps<"iconGrid">) {
  const { width, height } = stage.content;
  const items = content.items;
  const n = items.length;
  const portrait = stage.orientation === "portrait";
  const columns = gridColumns(n, stage.format);
  const rows = Math.ceil(n / columns);
  const gap = portrait ? 24 : 22;
  const heading = headingFit(content.heading, width, portrait ? 68 : 60, 160);
  const avail = height - heading.height - 2 * gap;
  const cellWidth = (width - gap * (columns - 1)) / columns;
  const cellHeight = Math.min(portrait ? 300 : 280, (avail - gap * (rows - 1)) / rows);
  const inner = cellHeight - 2 * pad.y - 6;
  const icon = Math.round(Math.min(cellWidth * 0.36, inner * 0.5, 130));
  const innerGap = Math.round(Math.min(20, inner * 0.08));
  const labelWidth = cellWidth - 2 * pad.x - 6;
  const label = Math.min(
    ...items.map((item) =>
      fitBox(item.label, portrait ? 42 : 38, 20, labelWidth, inner - icon - innerGap, 1.15, 2),
    ),
  );
  const atOf = (i: number) => at(`items[${i}].trigger`);
  return (
    <Place box={stage.content} style={{ justifyContent: "center", gap }}>
      <Heading
        text={content.heading}
        size={heading.size}
        atMs={at("headingTrigger")}
        theme={theme}
        style={{ marginBottom: gap }}
      />
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap }}>
        {items.map((item, i) => (
          <Cell
            key={i}
            item={item}
            atMs={atOf(i)}
            nextAtMs={atOf(i + 1)}
            theme={theme}
            sizes={{ width: cellWidth, height: cellHeight, icon, label, gap: innerGap }}
          />
        ))}
      </div>
    </Place>
  );
}
