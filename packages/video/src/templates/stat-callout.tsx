// Stat callout (DB §6): one big number in the accent, counting up to itself as it's said
// ("72%", "₹1,20,000"; text that isn't a number just appears), its label below, and the
// source in small type. The same layout in every format, sized to the content box.
import { Easing, interpolate, useCurrentFrame } from "remotion";
import { msToFrame } from "@vidcosmos/spec/video";
import { useAppear, usePulse } from "../anim";
import { fitBox } from "../fonts";
import { countingText } from "../numbers";
import { IconTile, Place, sourceText, Text, textHeight } from "../parts";
import type { SceneProps } from "../scene-props";

/** Frames the value takes to count up. */
const countFrames = 30;
/** How much the value grows on its emphasis beat. */
const pulsePeak = 1.05;

export function StatCalloutScene({
  content,
  language,
  theme,
  stage,
  at,
}: SceneProps<"statCallout">) {
  const frame = useCurrentFrame();
  const valueAt = at("valueTrigger");
  const labelAt = at("labelTrigger");
  const valueIn = useAppear(valueAt, { damping: 12 });
  const labelIn = useAppear(labelAt ?? valueAt, { delay: labelAt === undefined ? 14 : 0 });
  // The emphasis beat once the count has landed.
  const pulse = usePulse(valueAt === undefined ? undefined : valueAt + 1000, pulsePeak);
  const counted = interpolate(frame - msToFrame(valueAt ?? 0), [0, countFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const drawn = interpolate(frame - msToFrame(valueAt ?? 0), [10, 28], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const portrait = stage.orientation === "portrait";
  const { width, height } = stage.content;
  const gap = portrait ? 36 : 28;
  const icon = content.icon ? (portrait ? 132 : 110) : 0;
  const source = content.source ? sourceText(content.source, language) : null;
  const sourceSize = source ? fitBox(source, 30, 20, width, 80, 1.2) : 0;
  const sourceHeight = source ? textHeight(source, sourceSize, width, 1.2) + gap : 0;
  // Fitted with room for the pulse, which scales the value (as wide as its text) by 5%.
  const valueWidth = width / (pulsePeak + 0.01);
  const valueSize = fitBox(
    content.value,
    portrait ? 230 : 210,
    72,
    valueWidth,
    height * 0.34,
    1,
    1,
  );
  const valueHeight = textHeight(content.value, valueSize, valueWidth, 1) * pulsePeak;
  const labelWidth = stage.orientation === "landscape" ? Math.min(width, 1400) : width;
  const labelRoom = height - (icon ? icon + gap : 0) - valueHeight - 14 - 24 - gap - sourceHeight;
  const labelSize = fitBox(content.label, portrait ? 58 : 52, 28, labelWidth, labelRoom, 1.25);

  return (
    <Place box={stage.content} style={{ justifyContent: "center", gap }}>
      {content.icon ? (
        <div style={{ transform: `scale(${valueIn})`, transformOrigin: "left center" }}>
          <IconTile name={content.icon} size={icon} theme={theme} />
        </div>
      ) : null}
      <div style={{ opacity: valueIn, transform: `translateY(${(1 - valueIn) * 50}px)` }}>
        <div
          style={{
            width: "fit-content",
            maxWidth: valueWidth,
            transform: `scale(${pulse})`,
            transformOrigin: "left center",
          }}
        >
          <Text
            size={valueSize}
            weight={800}
            color={theme.accent}
            display
            lineHeight={1}
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {countingText(content.value, counted)}
          </Text>
        </div>
        <div
          style={{
            marginTop: 24,
            height: 14,
            width: 260 * drawn,
            borderRadius: 7,
            background: theme.accent,
          }}
        />
      </div>
      <div
        style={{
          width: labelWidth,
          opacity: labelIn,
          transform: `translateY(${(1 - labelIn) * 30}px)`,
        }}
      >
        <Text size={labelSize} weight={600} color={theme.text} lineHeight={1.25}>
          {content.label}
        </Text>
      </div>
      {source ? (
        <div style={{ opacity: labelIn }}>
          <Text size={sourceSize} weight={500} color={theme.muted}>
            {source}
          </Text>
        </div>
      ) : null}
    </Place>
  );
}
