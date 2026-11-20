// Title (DB §6): a big heading that builds word by word as it's said, an accent underline, an
// optional icon and subheading. For the hook and a closing takeaway. Ported from the
// prototype; the same layout in every format, sized to the content box.
import { interpolate, useCurrentFrame } from "remotion";
import { msToFrame } from "@vidcosmos/spec/video";
import { useAppear, usePulse } from "../anim";
import { fitFontSize, fontFamilies, lineHeightFor } from "../fonts";
import { IconTile, Place, Text } from "../parts";
import type { SceneProps } from "../scene-props";

export function TitleScene({ content, theme, stage, at }: SceneProps<"title">) {
  const frame = useCurrentFrame();
  const headingAt = at("headingTrigger");
  const subAt = at("subheadingTrigger");
  const iconIn = useAppear(headingAt, { damping: 12 });
  const subIn = useAppear(subAt ?? headingAt, { delay: subAt === undefined ? 10 : 0 });
  const pulse = usePulse(headingAt, 1.04);
  const start = msToFrame(headingAt ?? 0);
  const portrait = stage.orientation === "portrait";
  const base = portrait ? 112 : stage.orientation === "landscape" ? 104 : 92;
  const size = fitFontSize(content.heading, base, portrait ? 20 : 26, base * 0.56);
  const underline = interpolate(frame - start, [8, 26], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const words = content.heading.split(" ");

  return (
    <Place box={stage.content} style={{ justifyContent: "center", gap: portrait ? 44 : 36 }}>
      {content.icon ? (
        <div
          style={{
            transform: `scale(${iconIn}) rotate(${(1 - iconIn) * -20}deg)`,
            transformOrigin: "left center",
          }}
        >
          <IconTile name={content.icon} size={portrait ? 150 : 128} theme={theme} />
        </div>
      ) : null}
      <div style={{ transform: `scale(${pulse})`, transformOrigin: "left center" }}>
        <div
          data-text={content.heading}
          style={{
            fontFamily: fontFamilies.display,
            fontSize: size,
            fontWeight: 800,
            lineHeight: lineHeightFor(content.heading, 1.05),
            letterSpacing: "-0.03em",
            color: theme.text,
            display: "flex",
            flexWrap: "wrap",
            columnGap: size * 0.26,
            overflowWrap: "anywhere",
          }}
        >
          {words.map((word, i) => {
            const shown = interpolate(frame - start - i * 3, [0, 10], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            return (
              <span
                key={i}
                style={{
                  opacity: shown,
                  transform: `translateY(${(1 - shown) * 40}px)`,
                  display: "inline-block",
                  maxWidth: "100%",
                }}
              >
                {word}
              </span>
            );
          })}
        </div>
        <div
          style={{
            marginTop: 28,
            height: 14,
            width: 260 * underline,
            borderRadius: 7,
            background: theme.accent,
          }}
        />
      </div>
      {content.subheading ? (
        <div
          style={{
            opacity: subIn,
            transform: `translateY(${(1 - subIn) * 30}px)`,
            maxWidth: portrait ? "100%" : "75%",
          }}
        >
          <Text
            size={fitFontSize(content.subheading, portrait ? 52 : 46, 36, 34)}
            weight={500}
            color={theme.muted}
            lineHeight={1.3}
          >
            {content.subheading}
          </Text>
        </div>
      ) : null}
    </Place>
  );
}
