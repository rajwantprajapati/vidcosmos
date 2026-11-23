// Key term (DB §6): a word or phrase in large type with an accent underline, and its
// definition in a card below. The term springs in as it's said; the definition follows on its
// own trigger, or a moment after the term. The same layout in every format, sized to the
// content box; in 16:9 the definition is kept to a readable line length.
import { interpolate, useCurrentFrame } from "remotion";
import { msToFrame } from "@vidcosmos/spec/video";
import { useAppear, usePulse } from "../anim";
import { fitBox } from "../fonts";
import { IconTile, Place, Text, textHeight } from "../parts";
import type { SceneProps } from "../scene-props";

const cardPad = { x: 40, y: 32, accent: 12 };
const underline = { gap: 24, height: 14 };
/** How much the term grows on its emphasis beat. */
const pulsePeak = 1.04;

export function KeyTermScene({ content, theme, stage, at }: SceneProps<"keyTerm">) {
  const frame = useCurrentFrame();
  const termAt = at("termTrigger");
  const definitionAt = at("definitionTrigger");
  const termIn = useAppear(termAt, { damping: 12 });
  const definitionIn = useAppear(definitionAt ?? termAt, {
    delay: definitionAt === undefined ? 12 : 0,
  });
  const pulse = usePulse(termAt, pulsePeak);
  const drawn = interpolate(frame - msToFrame(termAt ?? 0), [6, 24], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const portrait = stage.orientation === "portrait";
  const { width, height } = stage.content;
  const gap = portrait ? 40 : 32;
  const icon = content.icon ? (portrait ? 140 : 116) : 0;
  // Fitted with room for the pulse, which scales the term (as wide as its text) by 4%.
  const termWidth = width / (pulsePeak + 0.01);
  const termSize = fitBox(
    content.term,
    portrait ? 120 : 108,
    44,
    termWidth,
    height * 0.36,
    1.05,
    2,
  );
  const termHeight = textHeight(content.term, termSize, termWidth, 1.05) * pulsePeak;
  const cardWidth = stage.orientation === "landscape" ? Math.min(width, 1400) : width;
  const definitionWidth = cardWidth - 2 * cardPad.x - cardPad.accent;
  const definitionRoom =
    height -
    (icon ? icon + gap : 0) -
    termHeight -
    underline.gap -
    underline.height -
    gap -
    2 * cardPad.y;
  const definitionSize = fitBox(
    content.definition,
    portrait ? 54 : 48,
    26,
    definitionWidth,
    definitionRoom,
    1.3,
  );

  return (
    <Place box={stage.content} style={{ justifyContent: "center", gap }}>
      {content.icon ? (
        <div style={{ transform: `scale(${termIn})`, transformOrigin: "left center" }}>
          <IconTile name={content.icon} size={icon} theme={theme} />
        </div>
      ) : null}
      <div style={{ opacity: termIn, transform: `translateY(${(1 - termIn) * 40}px)` }}>
        <div
          style={{
            width: "fit-content",
            maxWidth: termWidth,
            transform: `scale(${pulse})`,
            transformOrigin: "left center",
          }}
        >
          <Text size={termSize} weight={800} color={theme.text} display lineHeight={1.05}>
            {content.term}
          </Text>
        </div>
        <div
          style={{
            marginTop: underline.gap,
            height: underline.height,
            width: 220 * drawn,
            borderRadius: underline.height / 2,
            background: theme.accent,
          }}
        />
      </div>
      <div
        data-box
        style={{
          width: cardWidth,
          boxSizing: "border-box",
          padding: `${cardPad.y}px ${cardPad.x}px`,
          borderRadius: 30,
          background: theme.panel,
          borderLeft: `${cardPad.accent}px solid ${theme.accent}`,
          opacity: definitionIn,
          transform: `translateY(${(1 - definitionIn) * 40}px)`,
        }}
      >
        <Text size={definitionSize} weight={500} color={theme.text} lineHeight={1.3}>
          {content.definition}
        </Text>
      </div>
    </Place>
  );
}
