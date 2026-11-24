// Quiz (DB §6): a question and 2-4 lettered options, each appearing as it's said. On the
// reveal the right option fills with the accent and its letter turns into a tick, and the
// others fade back, so the answer reads by its mark as well as its colour. Options stack in
// 9:16 and 1:1, and sit two a row in 16:9 when there are three or four.
import { interpolate } from "remotion";
import { useAppear, useIsActive, usePulse } from "../anim";
import { fitBox } from "../fonts";
import { Icon, Place, Text, textHeight } from "../parts";
import type { SceneProps } from "../scene-props";
import type { VideoTheme } from "../theme";

const letters = ["A", "B", "C", "D"];
const pad = { x: 26, gap: 22 };

function Option({
  text,
  index,
  correct,
  atMs,
  nextAtMs,
  revealAtMs,
  theme,
  sizes,
}: {
  text: string;
  index: number;
  correct: boolean;
  atMs: number | undefined;
  nextAtMs: number | undefined;
  revealAtMs: number | undefined;
  theme: VideoTheme;
  sizes: { width: number; height: number; badge: number; text: number; pad: number };
}) {
  const shown = useAppear(atMs);
  const revealed = useAppear(revealAtMs, { damping: 14 });
  const pulse = usePulse(correct ? revealAtMs : undefined, 1.06);
  const active = useIsActive(atMs, nextAtMs) && revealed < 0.5;
  const on = correct && revealed > 0.5;
  const fade = correct ? 1 : interpolate(revealed, [0, 1], [1, 0.4]);
  return (
    <div
      data-box
      style={{
        width: sizes.width,
        minHeight: sizes.height,
        boxSizing: "border-box",
        padding: `${sizes.pad}px ${pad.x}px`,
        borderRadius: 28,
        background: on ? theme.accent : theme.panel,
        border: `3px solid ${on || active ? theme.accent : theme.line}`,
        boxShadow: on ? `0 0 70px ${theme.glow}` : "none",
        display: "flex",
        alignItems: "center",
        gap: pad.gap,
        opacity: shown * fade,
        transform: `translateY(${(1 - shown) * 40}px) scale(${pulse})`,
      }}
    >
      <div
        style={{
          width: sizes.badge,
          height: sizes.badge,
          borderRadius: sizes.badge,
          flexShrink: 0,
          background: on ? theme.onAccent : active ? theme.accent : theme.line,
          color: active ? theme.onAccent : theme.text,
          fontSize: sizes.badge * 0.46,
          fontWeight: 800,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {on ? (
          <Icon name="Check" size={sizes.badge * 0.6} color={theme.accent} strokeWidth={3} />
        ) : (
          letters[index]
        )}
      </div>
      <Text size={sizes.text} weight={650} color={on ? theme.onAccent : theme.text}>
        {text}
      </Text>
    </div>
  );
}

export function QuizScene({ content, theme, stage, at }: SceneProps<"quiz">) {
  const { width, height } = stage.content;
  const options = content.options;
  const n = options.length;
  const portrait = stage.orientation === "portrait";
  const questionIn = useAppear(at("questionTrigger"));
  const gap = n > 3 ? 18 : 24;
  const columns = stage.orientation === "landscape" && n >= 3 ? 2 : 1;
  const rows = Math.ceil(n / columns);
  const question = fitBox(content.question, portrait ? 66 : 58, 34, width, height * 0.34, 1.15);
  const questionHeight = textHeight(content.question, question, width, 1.15);
  const avail = height - questionHeight - 2 * gap;
  const optionWidth = (width - gap * (columns - 1)) / columns;
  const optionHeight = Math.min(portrait ? 150 : 140, (avail - gap * (rows - 1)) / rows);
  const optionPad = Math.max(8, Math.min(18, Math.round(optionHeight * 0.12)));
  const badge = Math.round(Math.min(76, optionHeight * 0.56));
  const textWidth = optionWidth - 2 * pad.x - 6 - badge - pad.gap;
  const text = Math.min(
    ...options.map((o) =>
      fitBox(o.text, n > 3 ? 44 : 48, 22, textWidth, optionHeight - 2 * optionPad - 6, 1.2, 2),
    ),
  );
  const revealAtMs = at("reveal.trigger");
  return (
    <Place box={stage.content} style={{ justifyContent: "center", gap }}>
      <div
        style={{
          marginBottom: gap,
          opacity: questionIn,
          transform: `translateY(${(1 - questionIn) * 30}px)`,
        }}
      >
        <Text size={question} weight={800} color={theme.text} display lineHeight={1.15}>
          {content.question}
        </Text>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap }}>
        {options.map((option, i) => (
          <Option
            key={i}
            text={option.text}
            index={i}
            correct={i === content.answerIndex}
            atMs={at(`options[${i}].trigger`)}
            nextAtMs={at(`options[${i + 1}].trigger`) ?? revealAtMs}
            revealAtMs={revealAtMs}
            theme={theme}
            sizes={{
              width: optionWidth,
              height: optionHeight,
              badge,
              text,
              pad: optionPad,
            }}
          />
        ))}
      </div>
    </Place>
  );
}
