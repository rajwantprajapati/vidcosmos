// Timeline (DB §6): a heading and 3-6 events, each a date and a label, on a rail that draws
// from one event to the next as each is said; the event being talked about is lit. The rail
// runs top to bottom in 9:16 and 1:1, and left to right in 16:9 with dates above it and labels
// below.
import type { TemplateContent } from "@vidcosmos/spec/video";
import { useAppear, useDraw, useIsActive, usePulse } from "../anim";
import { fitBox } from "../fonts";
import { Heading, headingFit, Place, Text, textHeight } from "../parts";
import type { SceneProps } from "../scene-props";
import type { VideoTheme } from "../theme";

type Event = TemplateContent<"timeline">["events"][number];

const dot = 34;
const rail = 6;

/** A round marker on the rail: filled while its event is the one being talked about. */
function Dot({ shown, active, theme }: { shown: number; active: boolean; theme: VideoTheme }) {
  return (
    <div
      style={{
        width: dot,
        height: dot,
        borderRadius: dot,
        boxSizing: "border-box",
        background: active ? theme.accent : theme.bg,
        border: `6px solid ${theme.accent}`,
        boxShadow: active ? `0 0 40px ${theme.glow}` : "none",
        transform: `scale(${shown})`,
        flexShrink: 0,
        position: "relative",
        zIndex: 1,
      }}
    />
  );
}

/** One event in the vertical layout: its dot, the rail up to the one above, and its card. */
function Row({
  event,
  first,
  atMs,
  nextAtMs,
  theme,
  sizes,
}: {
  event: Event;
  first: boolean;
  atMs: number | undefined;
  nextAtMs: number | undefined;
  theme: VideoTheme;
  sizes: { row: number; gap: number; pad: number; date: number; label: number };
}) {
  const shown = useAppear(atMs);
  const drawn = useDraw(atMs, 0, 10);
  const pulse = usePulse(atMs, 1.03);
  const active = useIsActive(atMs, nextAtMs);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 28, minHeight: sizes.row }}>
      <div
        style={{
          width: dot,
          alignSelf: "stretch",
          position: "relative",
          display: "flex",
          alignItems: "center",
        }}
      >
        {first ? null : (
          <div
            style={{
              position: "absolute",
              left: (dot - rail) / 2,
              top: -sizes.gap - sizes.row / 2,
              width: rail,
              height: sizes.row + sizes.gap,
              borderRadius: rail,
              background: theme.accent,
              transform: `scaleY(${drawn})`,
              transformOrigin: "top",
            }}
          />
        )}
        <Dot shown={shown} active={active} theme={theme} />
      </div>
      <div
        data-box
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: sizes.row,
          boxSizing: "border-box",
          padding: `${sizes.pad}px 28px`,
          borderRadius: 26,
          background: theme.panel,
          border: `3px solid ${active ? theme.accent : theme.line}`,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 4,
          opacity: shown,
          transform: `translateX(${(1 - shown) * 80}px) scale(${pulse})`,
        }}
      >
        <Text size={sizes.date} weight={800} color={theme.accent} lineHeight={1.15}>
          {event.date}
        </Text>
        <Text size={sizes.label} weight={600} color={theme.text}>
          {event.label}
        </Text>
      </div>
    </div>
  );
}

/** One event in the horizontal layout: date above the rail, dot on it, label below. */
function Column({
  event,
  first,
  atMs,
  nextAtMs,
  theme,
  sizes,
}: {
  event: Event;
  first: boolean;
  atMs: number | undefined;
  nextAtMs: number | undefined;
  theme: VideoTheme;
  sizes: { column: number; dateHeight: number; date: number; label: number; pad: number };
}) {
  const shown = useAppear(atMs);
  const drawn = useDraw(atMs, 0, 10);
  const pulse = usePulse(atMs, 1.03);
  const active = useIsActive(atMs, nextAtMs);
  return (
    <div
      style={{
        width: sizes.column,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 20,
      }}
    >
      <div
        style={{
          height: sizes.dateHeight,
          width: sizes.column - 24,
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          textAlign: "center",
          opacity: shown,
          transform: `translateY(${(1 - shown) * -30}px)`,
        }}
      >
        <Text size={sizes.date} weight={800} color={theme.accent} lineHeight={1.15}>
          {event.date}
        </Text>
      </div>
      <div
        style={{ position: "relative", width: "100%", display: "flex", justifyContent: "center" }}
      >
        {first ? null : (
          <div
            style={{
              position: "absolute",
              left: -sizes.column / 2,
              top: (dot - rail) / 2,
              width: sizes.column,
              height: rail,
              borderRadius: rail,
              background: theme.accent,
              transform: `scaleX(${drawn})`,
              transformOrigin: "left",
            }}
          />
        )}
        <Dot shown={shown} active={active} theme={theme} />
      </div>
      <div
        data-box
        style={{
          width: sizes.column - 20,
          boxSizing: "border-box",
          padding: `${sizes.pad}px 20px`,
          borderRadius: 24,
          background: theme.panel,
          border: `3px solid ${active ? theme.accent : theme.line}`,
          textAlign: "center",
          opacity: shown,
          transform: `translateY(${(1 - shown) * 40}px) scale(${pulse})`,
        }}
      >
        <Text size={sizes.label} weight={600} color={theme.text}>
          {event.label}
        </Text>
      </div>
    </div>
  );
}

export function TimelineScene({ content, theme, stage, at }: SceneProps<"timeline">) {
  const { width, height } = stage.content;
  const events = content.events;
  const n = events.length;
  const portrait = stage.orientation === "portrait";
  const gap = n > 4 ? 14 : 22;
  const heading = headingFit(content.heading, width, portrait ? 68 : 60, 160);
  const avail = height - heading.height - 2 * gap;
  const atOf = (i: number) => at(`events[${i}].trigger`);

  if (stage.orientation === "landscape") {
    const column = width / n;
    const pad = 18;
    const dateWidth = column - 24;
    const date = Math.min(...events.map((e) => fitBox(e.date, 40, 22, dateWidth, 100, 1.15, 2)));
    const dateHeight = Math.max(...events.map((e) => textHeight(e.date, date, dateWidth, 1.15)));
    const labelWidth = column - 20 - 2 * 20 - 6;
    const labelRoom = avail - dateHeight - dot - 2 * 20 - 2 * pad - 6;
    const label = Math.min(
      ...events.map((e) => fitBox(e.label, 36, 20, labelWidth, Math.min(labelRoom, 260), 1.2)),
    );
    return (
      <Place box={stage.content} style={{ justifyContent: "center", gap: 2 * gap }}>
        <Heading
          text={content.heading}
          size={heading.size}
          atMs={at("headingTrigger")}
          theme={theme}
        />
        <div style={{ display: "flex", alignItems: "flex-start" }}>
          {events.map((event, i) => (
            <Column
              key={i}
              event={event}
              first={i === 0}
              atMs={atOf(i)}
              nextAtMs={atOf(i + 1)}
              theme={theme}
              sizes={{ column, dateHeight, date, label, pad }}
            />
          ))}
        </div>
      </Place>
    );
  }

  const row = Math.min(portrait ? 170 : 150, (avail - gap * (n - 1)) / n);
  const pad = Math.max(8, Math.min(18, Math.round(row * 0.1)));
  const textWidth = width - dot - 28 - 2 * 28 - 6;
  const inner = row - 2 * pad - 6 - 4;
  const date = Math.min(
    ...events.map((e) => fitBox(e.date, 38, 20, textWidth, inner * 0.45, 1.15, 1)),
  );
  const dateHeight = Math.max(...events.map((e) => textHeight(e.date, date, textWidth, 1.15)));
  const label = Math.min(
    ...events.map((e) => fitBox(e.label, 44, 20, textWidth, inner - dateHeight, 1.2, 2)),
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
      {events.map((event, i) => (
        <Row
          key={i}
          event={event}
          first={i === 0}
          atMs={atOf(i)}
          nextAtMs={atOf(i + 1)}
          theme={theme}
          sizes={{ row, gap, pad, date, label }}
        />
      ))}
    </Place>
  );
}
