// Remotion Studio and the renderer: `Explainer` with a sample video, and one `Still` per case
// for `pnpm video:stills`. Fonts load from the design system's files (Studio and the bundler
// serve design/design-system/fonts as the public folder) before any frame is drawn.
import { useEffect, useState, type ReactNode } from "react";
import { Composition, continueRender, delayRender, Folder, staticFile } from "remotion";
import { videoFormats } from "../format";
import { loadFonts } from "../fonts";
import { compositionSize, Explainer, type ExplainerProps, totalFrames } from "../explainer";
import { palettes } from "../theme";
import { stillSpec, stillTemplates } from "./cases";

/** Holds rendering until the fonts are ready, so no frame uses a fallback font. */
function FontGate({ children }: { children: ReactNode }) {
  const [handle] = useState(() => delayRender("Loading fonts"));
  useEffect(() => {
    loadFonts(staticFile)
      .catch((error: unknown) => console.error("Couldn't load the fonts", error))
      .finally(() => continueRender(handle));
  }, [handle]);
  return <>{children}</>;
}

function Video(props: ExplainerProps) {
  return (
    <FontGate>
      <Explainer {...props} />
    </FontGate>
  );
}

const metadata = ({ props }: { props: ExplainerProps }) => ({
  ...compositionSize(props.spec),
  durationInFrames: Math.max(1, totalFrames(props.spec)),
});

const sample = (format: (typeof videoFormats)[number]): ExplainerProps => ({
  spec: {
    ...stillSpec("title", "en", "long", format, "midnight"),
    scenes: stillTemplates.map((template, i) => ({
      ...stillSpec(template, "en", "long", format, "midnight").scenes[0]!,
      id: `sc_sample${i}`,
    })),
  },
});

export function Root() {
  return (
    <>
      {videoFormats.map((format) => (
        <Composition
          key={format}
          id={`Explainer-${format.replace(":", "x")}`}
          component={Video}
          fps={30}
          {...compositionSize({ format })}
          durationInFrames={totalFrames(sample(format).spec)}
          defaultProps={sample(format)}
          calculateMetadata={metadata}
        />
      ))}
      <Folder name="Stills">
        <Composition
          id="Still"
          component={Video}
          fps={30}
          width={1080}
          height={1920}
          durationInFrames={1}
          defaultProps={{
            spec: stillSpec("bullets", "en", "long", "9:16", palettes[0]!),
            checkLayout: true,
          }}
          calculateMetadata={metadata}
        />
      </Folder>
    </>
  );
}
