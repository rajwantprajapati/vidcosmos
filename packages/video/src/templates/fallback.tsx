// The other eight templates arrive in F19. Until then a scene of theirs shows its headline and
// its elements as a list, each appearing as it's said, so a whole storyboard still plays.
import { type Scene, sceneElements, sceneHeadline } from "@vidcosmos/spec/video";
import { useAppear } from "../anim";
import { fitFontSize } from "../fonts";
import type { Stage } from "../format";
import { Place, Text } from "../parts";
import type { VideoTheme } from "../theme";

function Item({
  label,
  atMs,
  theme,
}: {
  label: string;
  atMs: number | undefined;
  theme: VideoTheme;
}) {
  const shown = useAppear(atMs);
  return (
    <div
      data-box
      style={{
        borderRadius: 26,
        padding: "20px 28px",
        background: theme.panel,
        border: `3px solid ${theme.line}`,
        opacity: shown,
        transform: `translateY(${(1 - shown) * 30}px)`,
      }}
    >
      <Text size={fitFontSize(label, 44, 24, 30)} weight={600} color={theme.text}>
        {label}
      </Text>
    </div>
  );
}

export function FallbackScene({
  scene,
  theme,
  stage,
  at,
}: {
  scene: Scene;
  theme: VideoTheme;
  stage: Stage;
  at: (path: string) => number | undefined;
}) {
  const headline = sceneHeadline(scene);
  const elements = sceneElements(scene)
    .filter((element) => element.label !== headline)
    .slice(0, 6);
  return (
    <Place box={stage.content} style={{ justifyContent: "center", gap: 22 }}>
      {headline ? (
        <Text
          size={fitFontSize(headline, 68, 24, 44)}
          weight={800}
          color={theme.text}
          display
          lineHeight={1.1}
        >
          {headline}
        </Text>
      ) : null}
      {elements.map((element) => (
        <Item key={element.path} label={element.label} atMs={at(element.path)} theme={theme} />
      ))}
    </Place>
  );
}
