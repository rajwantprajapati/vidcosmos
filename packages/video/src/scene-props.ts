// What every template gets: its content, the video's language, the theme, the stage (canvas,
// safe area and content box for the format) and when each element appears.
import type { TemplateContent, TemplateName } from "@vidcosmos/spec/video";
import type { Stage } from "./format";
import type { VideoTheme } from "./theme";

export type SceneProps<T extends TemplateName> = {
  content: TemplateContent<T>;
  /** For numbers and words a template adds, such as "lakh" on a chart. */
  language: "en" | "hi";
  theme: VideoTheme;
  stage: Stage;
  /** When the element whose trigger is at `path` appears, in ms from the scene's start. */
  at: (path: string) => number | undefined;
};
