// Recap (DB §6): a heading and 2-4 points, each ticked off as it's said, and an optional call
// to action in an accent pill at the end, on its own trigger or a moment after the last point.
// One column in every format; rows share the content box's height.
import type { TemplateContent } from "@vidcosmos/spec/video";
import { useAppear, useIsActive, usePulse } from "../anim";
import { fitBox } from "../fonts";
import { Heading, headingFit, Icon, Place, Text, textHeight } from "../parts";
import type { SceneProps } from "../scene-props";
import type { VideoTheme } from "../theme";

type Point = TemplateContent<"recap">["points"][number];

function Row({
  point,
  atMs,
  nextAtMs,
  theme,
  sizes,
}: {
  point: Point;
  atMs: number | undefined;
  nextAtMs: number | undefined;
  theme: VideoTheme;
  sizes: { height: number; pad: number; tick: number; text: number };
}) {
  const shown = useAppear(atMs);
  const ticked = useAppear(atMs, { delay: 6, damping: 10 });
  const pulse = usePulse(atMs, 1.03);
  const active = useIsActive(atMs, nextAtMs);
  return (
    <div
      data-box
      style={{
        minHeight: sizes.height,
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        gap: 26,
        padding: `${sizes.pad}px 30px`,
        borderRadius: 30,
        background: theme.panel,
        border: `3px solid ${active ? theme.accent : theme.line}`,
        opacity: shown,
        transform: `translateX(${(1 - shown) * -100}px) scale(${pulse})`,
      }}
    >
      <div
        style={{
          width: sizes.tick,
          height: sizes.tick,
          borderRadius: sizes.tick,
          flexShrink: 0,
          background: theme.accent,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transform: `scale(${ticked})`,
        }}
      >
        <Icon name="Check" size={sizes.tick * 0.6} color={theme.onAccent} strokeWidth={3} />
      </div>
      <Text size={sizes.text} weight={650} color={theme.text}>
        {point.text}
      </Text>
    </div>
  );
}

const ctaPad = { x: 40, y: 24 };

export function RecapScene({ content, theme, stage, at }: SceneProps<"recap">) {
  const { width, height } = stage.content;
  const points = content.points;
  const n = points.length;
  const portrait = stage.orientation === "portrait";
  const gap = n > 3 ? 20 : 26;
  const lastAt = at(`points[${n - 1}].trigger`);
  const ctaAt = at("ctaTrigger");
  const ctaIn = useAppear(ctaAt ?? lastAt, { delay: ctaAt === undefined ? 18 : 0, damping: 12 });
  const ctaPulse = usePulse(ctaAt ?? lastAt, 1.05);
  const heading = headingFit(content.heading, width, portrait ? 72 : 64, 160);
  const ctaArrow = portrait ? 48 : 42;
  const ctaWidth = width - 2 * ctaPad.x - ctaArrow - 18;
  const cta = content.cta ? fitBox(content.cta, portrait ? 46 : 42, 24, ctaWidth, 120, 1.15) : 0;
  const ctaHeight = content.cta
    ? Math.max(ctaArrow, textHeight(content.cta, cta, ctaWidth, 1.15)) + 2 * ctaPad.y + 2 * gap
    : 0;
  const avail = height - heading.height - 2 * gap - ctaHeight;
  const row = Math.min(portrait ? 160 : 140, (avail - gap * (n - 1)) / n);
  const pad = Math.max(8, Math.min(20, Math.round(row * 0.13)));
  const tick = Math.round(Math.min(68, row * 0.5));
  const textWidth = width - 2 * 30 - 6 - tick - 26;
  const text = Math.min(
    ...points.map((p) => fitBox(p.text, n > 3 ? 46 : 52, 24, textWidth, row - 2 * pad - 6, 1.2, 2)),
  );
  return (
    <Place box={stage.content} style={{ justifyContent: "center", gap }}>
      <Heading
        text={content.heading}
        size={heading.size}
        atMs={at("headingTrigger")}
        theme={theme}
        style={{ marginBottom: gap }}
      />
      {points.map((point, i) => (
        <Row
          key={i}
          point={point}
          atMs={at(`points[${i}].trigger`)}
          nextAtMs={at(`points[${i + 1}].trigger`) ?? ctaAt}
          theme={theme}
          sizes={{ height: row, pad, tick, text: text }}
        />
      ))}
      {content.cta ? (
        <div
          data-box
          style={{
            marginTop: gap,
            alignSelf: "flex-start",
            maxWidth: "100%",
            boxSizing: "border-box",
            padding: `${ctaPad.y}px ${ctaPad.x}px`,
            borderRadius: 999,
            background: theme.accent,
            display: "flex",
            alignItems: "center",
            gap: 18,
            opacity: ctaIn,
            transform: `translateY(${(1 - ctaIn) * 40}px) scale(${ctaPulse})`,
            transformOrigin: "left center",
          }}
        >
          <Text size={cta} weight={800} color={theme.onAccent} display lineHeight={1.15}>
            {content.cta}
          </Text>
          <Icon name="ArrowRight" size={ctaArrow} color={theme.onAccent} strokeWidth={2.6} />
        </div>
      ) : null}
    </Place>
  );
}
