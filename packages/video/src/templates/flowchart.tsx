// Flowchart (DB §6): 3-6 steps, each appearing as it's said with the arrow into it drawing
// first. "linear" runs top to bottom in 9:16 and 1:1 and left to right in 16:9; "cycle" puts
// the steps on a ring with arcs between them, the last leading back to the first. Ported from
// the prototype.
import { Fragment } from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { msToFrame, type TemplateContent } from "@vidcosmos/spec/video";
import { useAppear, useDraw, useIsActive, usePulse } from "../anim";
import { fitBox, lineHeightFor, linesFor } from "../fonts";
import type { Box } from "../format";
import { Icon, Place, Text } from "../parts";
import type { SceneProps } from "../scene-props";
import type { VideoTheme } from "../theme";

type Step = TemplateContent<"flowchart">["steps"][number];
type Timed = { step: Step; atMs: number | undefined; nextAtMs: number | undefined };

/** A step's round badge: its icon, or its number. */
function Badge({
  step,
  index,
  size,
  theme,
  active,
}: {
  step: Step;
  index: number;
  size: number;
  theme: VideoTheme;
  active: boolean;
}) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size,
        background: active ? theme.onAccent : theme.accent,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      {step.icon ? (
        <Icon
          name={step.icon}
          size={size * 0.55}
          color={active ? theme.accent : theme.onAccent}
          strokeWidth={2.4}
        />
      ) : (
        <span
          style={{
            fontSize: size * 0.48,
            fontWeight: 800,
            color: active ? theme.accent : theme.onAccent,
          }}
        >
          {index + 1}
        </span>
      )}
    </div>
  );
}

/** A step as a pill (in a column) or a card (in a row). */
function Node({
  timed,
  index,
  theme,
  size,
  row,
  labelSize,
}: {
  timed: Timed;
  index: number;
  theme: VideoTheme;
  size: number;
  row: boolean;
  labelSize: number;
}) {
  const shown = useAppear(timed.atMs);
  const pulse = usePulse(timed.atMs);
  const active = useIsActive(timed.atMs, timed.nextAtMs);
  const label = timed.step.label;
  return (
    <div
      data-box
      style={{
        ...(row
          ? {
              flex: 1,
              minWidth: 0,
              flexDirection: "column",
              padding: "28px 18px",
              textAlign: "center",
              gap: 18,
            }
          : { height: size, padding: "0 30px", gap: 26 }),
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        borderRadius: row ? 32 : size / 2.6,
        background: active ? theme.accent : theme.panel,
        border: `3px solid ${active ? theme.accent : theme.line}`,
        boxShadow: active ? `0 0 70px ${theme.glow}` : "none",
        opacity: shown,
        transform: `translateY(${(1 - shown) * 40}px) scale(${(0.9 + 0.1 * shown) * pulse})`,
      }}
    >
      <Badge
        step={timed.step}
        index={index}
        size={row ? 96 : size * 0.62}
        theme={theme}
        active={active}
      />
      <Text
        size={labelSize}
        weight={700}
        color={active ? theme.onAccent : theme.text}
        lineHeight={1.15}
      >
        {label}
      </Text>
    </div>
  );
}

/** The arrow into a step: down in a column, right in a row. */
function Arrow({
  atMs,
  theme,
  length,
  row,
}: {
  atMs: number | undefined;
  theme: VideoTheme;
  length: number;
  row: boolean;
}) {
  const drawn = useDraw(atMs, -6);
  const head = drawn > 0.95;
  const thick = 40;
  return (
    <div
      style={{
        display: "flex",
        justifyContent: row ? "center" : "flex-start",
        alignItems: "center",
        paddingLeft: row ? 0 : 76,
        flexShrink: 0,
      }}
    >
      <svg
        width={row ? length : thick}
        height={row ? thick : length}
        viewBox={row ? `0 0 ${length} ${thick}` : `0 0 ${thick} ${length}`}
      >
        {drawn > 0 ? (
          row ? (
            <line
              x1={4}
              y1={20}
              x2={4 + (length - 22) * drawn}
              y2={20}
              stroke={theme.accent}
              strokeWidth={6}
              strokeLinecap="round"
            />
          ) : (
            <line
              x1={20}
              y1={4}
              x2={20}
              y2={4 + (length - 22) * drawn}
              stroke={theme.accent}
              strokeWidth={6}
              strokeLinecap="round"
            />
          )
        ) : null}
        {head ? (
          <path
            d={
              row
                ? `M${length - 20} 8 L${length - 6} 20 L${length - 20} 32`
                : `M8 ${length - 20} L20 ${length - 6} L32 ${length - 20}`
            }
            fill="none"
            stroke={theme.accent}
            strokeWidth={6}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}
      </svg>
    </div>
  );
}

function Linear({
  steps,
  theme,
  box,
  row,
}: {
  steps: Timed[];
  theme: VideoTheme;
  box: Box;
  row: boolean;
}) {
  const gap = row ? 56 : steps.length > 4 ? 40 : 60;
  const size = Math.min(150, (box.height - gap * (steps.length - 1)) / steps.length);
  // The room a label has inside its card: a card in a row (badge above), or a pill in a
  // column (badge beside). One size for every label, from the one that needs the smallest, so
  // each longest word fits whole.
  const cardWidth = (box.width - gap * (steps.length - 1)) / steps.length;
  const labelSize = row
    ? Math.min(
        ...steps.map(({ step }) => fitBox(step.label, 38, 18, cardWidth - 42, 3 * 38 * 1.15, 1.15)),
      )
    : Math.min(
        ...steps.map(({ step }) =>
          fitBox(
            step.label,
            Math.min(54, size * 0.4),
            18,
            box.width - size * 0.62 - 26 - 66,
            size * 0.8,
            1.15,
          ),
        ),
      );
  return (
    <div
      style={{
        display: "flex",
        flexDirection: row ? "row" : "column",
        alignItems: row ? "center" : "stretch",
        width: "100%",
      }}
    >
      {steps.map((timed, i) => (
        <Fragment key={i}>
          {i > 0 ? <Arrow atMs={timed.atMs} theme={theme} length={gap} row={row} /> : null}
          <Node timed={timed} index={i} theme={theme} size={size} row={row} labelSize={labelSize} />
        </Fragment>
      ))}
    </div>
  );
}

/**
 * Where the cycle's cards go: on an ellipse that fills the box (wider than tall when there's
 * room), with cards as large as fits until neighbours would touch.
 */
export function cycleGeometry(n: number, box: { width: number; height: number }) {
  const base = { w: n <= 4 ? 300 : 250, h: 170 };
  const cx = box.width / 2;
  const cy = box.height / 2;
  const angle = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  let scale = 1;
  for (;;) {
    const w = base.w * scale;
    const h = base.h * scale;
    const ry = Math.max(60, box.height / 2 - h / 2 - 10);
    const rx = Math.max(60, Math.min(box.width / 2 - w / 2 - 10, ry * 1.8));
    const points = Array.from({ length: n }, (_, i) => ({
      x: cx + rx * Math.cos(angle(i)),
      y: cy + ry * Math.sin(angle(i)),
    }));
    const touching = points.some((p, i) => {
      const q = points[(i + 1) % n]!;
      return Math.abs(p.x - q.x) < w + 16 && Math.abs(p.y - q.y) < h + 16;
    });
    if (!touching || scale <= 0.45) return { w, h, rx, ry, cx, cy, angle, points };
    scale -= 0.05;
  }
}

function Cycle({ steps, theme, box }: { steps: Timed[]; theme: VideoTheme; box: Box }) {
  const frame = useCurrentFrame();
  const n = steps.length;
  const { w, h, rx, ry, cx, cy, angle, points } = cycleGeometry(n, box);
  const at = (a: number) => [cx + rx * Math.cos(a), cy + ry * Math.sin(a)] as const;
  // Arcs stop short of the cards: about half a card's width, as an angle on the ring.
  const gapAngle = (w * 0.62) / Math.min(rx, ry * 1.4);
  const lastAt = steps[n - 1]?.atMs ?? 0;

  return (
    <div style={{ position: "relative", width: box.width, height: box.height }}>
      <svg width={box.width} height={box.height} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <marker
            id="vc-arrowhead"
            viewBox="0 0 10 10"
            refX="6"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M0 0 L10 5 L0 10 z" fill={theme.accent} />
          </marker>
        </defs>
        {steps.map((_, i) => {
          const [x1, y1] = at(angle(i) + gapAngle / 2);
          const [x2, y2] = at(angle(i + 1) - gapAngle / 2);
          // The arc into each step draws as it appears; the closing arc after the last step.
          const start =
            i === n - 1 ? msToFrame(lastAt) + 18 : msToFrame(steps[i + 1]!.atMs ?? 0) - 8;
          const drawn = interpolate(frame - start, [0, 14], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          return (
            <path
              key={i}
              d={`M ${x1} ${y1} A ${rx} ${ry} 0 0 1 ${x2} ${y2}`}
              fill="none"
              stroke={theme.accent}
              strokeWidth={7}
              strokeLinecap="round"
              pathLength={1}
              strokeDasharray={1}
              strokeDashoffset={1 - drawn}
              markerEnd={drawn > 0.97 ? "url(#vc-arrowhead)" : undefined}
              opacity={0.9}
            />
          );
        })}
      </svg>
      {steps.map((timed, i) => (
        <CycleNode
          key={i}
          timed={timed}
          theme={theme}
          x={points[i]!.x}
          y={points[i]!.y}
          w={w}
          h={h}
        />
      ))}
    </div>
  );
}

function CycleNode({
  timed,
  theme,
  x,
  y,
  w,
  h,
}: {
  timed: Timed;
  theme: VideoTheme;
  x: number;
  y: number;
  w: number;
  h: number;
}) {
  const shown = useAppear(timed.atMs, { damping: 13 });
  const pulse = usePulse(timed.atMs, 1.07);
  const active = useIsActive(timed.atMs, timed.nextAtMs);
  return (
    <div
      data-box
      style={{
        position: "absolute",
        left: x - w / 2,
        top: y - h / 2,
        width: w,
        height: h,
        boxSizing: "border-box",
        borderRadius: 36,
        background: active ? theme.accent : theme.panel,
        border: `3px solid ${active ? theme.accent : theme.line}`,
        boxShadow: active ? `0 0 70px ${theme.glow}` : "none",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        padding: 14,
        opacity: shown,
        transform: `scale(${(0.6 + 0.4 * shown) * pulse})`,
        textAlign: "center",
      }}
    >
      <Icon
        name={timed.step.icon}
        size={Math.max(36, Math.round(h * 0.3))}
        color={active ? theme.onAccent : theme.accent}
        strokeWidth={2.3}
      />
      <Text
        size={fitBox(timed.step.label, 36, 18, w - 34, h * 0.55, 1.12)}
        weight={700}
        color={active ? theme.onAccent : theme.text}
        lineHeight={1.12}
      >
        {timed.step.label}
      </Text>
    </div>
  );
}

export function FlowchartScene({ content, theme, stage, at }: SceneProps<"flowchart">) {
  const headIn = useAppear(at("headingTrigger"));
  const portrait = stage.orientation === "portrait";
  const headingSize = fitBox(
    content.heading,
    portrait ? 70 : 60,
    40,
    stage.content.width,
    160,
    1.1,
  );
  const headingRoom = Math.round(
    linesFor(content.heading, headingSize, stage.content.width) *
      headingSize *
      lineHeightFor(content.heading, 1.1) +
      40,
  );
  const steps: Timed[] = content.steps.map((step, i) => ({
    step,
    atMs: at(`steps[${i}].trigger`),
    nextAtMs: at(`steps[${i + 1}].trigger`),
  }));
  const area: Box = {
    left: 0,
    top: 0,
    width: stage.content.width,
    height: stage.content.height - headingRoom,
  };
  return (
    <Place box={stage.content}>
      <div
        style={{
          height: headingRoom,
          flexShrink: 0,
          opacity: headIn,
          transform: `translateY(${(1 - headIn) * 30}px)`,
        }}
      >
        <Text size={headingSize} weight={800} color={theme.text} display lineHeight={1.1}>
          {content.heading}
        </Text>
      </div>
      <div style={{ flex: 1, display: "flex", alignItems: "center", minHeight: 0 }}>
        {content.layout === "cycle" ? (
          <Cycle steps={steps} theme={theme} box={area} />
        ) : (
          <Linear steps={steps} theme={theme} box={area} row={stage.orientation === "landscape"} />
        )}
      </div>
    </Place>
  );
}
