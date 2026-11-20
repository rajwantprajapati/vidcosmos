// The still cases (F18): each template (and the flowchart's two layouts) in English and Hindi,
// at the shortest and the longest text its limits allow, with the fewest and the most
// elements. `pnpm video:stills` renders each in every format and palette; Studio lists them.
// Narration says every trigger, then a closing line, so the still frame has all of them shown.
import {
  limits,
  type Scene,
  scene as sceneSchema,
  type VideoSpec,
  videoSpec,
} from "@vidcosmos/spec/video";
import type { VideoFormat } from "../format";
import type { Palette } from "../theme";

export type Language = "en" | "hi";
/**
 * short: the fewest elements and the shortest text. long: the most elements, text at every
 * limit. caps: the same in capitals, which are wider (acronym-heavy topics). word: the most
 * elements, each text one long word that can't wrap.
 */
export type Length = "short" | "long" | "caps" | "word";

/** Capitals and long words are English cases; Hindi has neither. */
export const stillLengths = (language: Language): Length[] =>
  language === "en" ? ["short", "long", "caps", "word"] : ["short", "long"];
export const stillTemplates = ["title", "bullets", "flowchart", "cycle", "comparison"] as const;
export type StillTemplate = (typeof stillTemplates)[number];

const bank = {
  en: "Payments move money between banks across India every single day quickly and safely".split(
    " ",
  ),
  hi: "भुगतान से पैसा हर दिन भारत के बैंकों के बीच तेज़ी से और सुरक्षित तरीके से पहुँचता है".split(
    " ",
  ),
};
/** Distinct words for triggers, said in this order. */
const marks = {
  en: "first second third fourth fifth sixth seventh eighth ninth tenth".split(" "),
  hi: "पहला दूसरा तीसरा चौथा पाँचवाँ छठा सातवाँ आठवाँ नौवाँ दसवाँ".split(" "),
};
const closing = {
  en: "And that is the whole idea, step by step, from the start to the very end.",
  hi: "और यही पूरी बात है, शुरू से आखिर तक, एक एक कदम करके।",
};
const shortest = { en: "UPI", hi: "यूपीआई" };
const capitals = "AUTHENTICATION WITH NPCI SERVERS AND BANK GATEWAYS MW UPI GST TDS RBI".split(" ");
const longWords = [
  "Internationalisation",
  "Telecommunications",
  "Electromagnetism",
  "Decarbonisation",
  "Authentication",
  "Photosynthesis",
];

/** Text of exactly `max` characters from the language's words, or the shortest label. */
function text(language: Language, length: Length, max: number, offset = 0): string {
  if (length === "short") return shortest[language];
  if (length === "word") return longWords[offset % longWords.length]!.slice(0, max);
  const words = length === "caps" ? capitals : bank[language];
  let out = "";
  for (let i = offset; out.length < max; i++) out += `${out ? " " : ""}${words[i % words.length]}`;
  return out.slice(0, max).trimEnd();
}

/** A scene whose narration says each trigger in turn. */
function narrated(
  language: Language,
  triggers: number,
  content: (mark: (i: number) => string) => Record<string, unknown>,
  template: string,
): Scene {
  const said = marks[language].slice(0, triggers).join(language === "en" ? ", then " : ", फिर ");
  return sceneSchema.parse({
    id: `sc_${template}`,
    template,
    narration: `${language === "en" ? "We start with" : "शुरुआत"} ${said}. ${closing[language]}`,
    content: content((i) => marks[language][i]!),
  });
}

export function stillScene(template: StillTemplate, language: Language, length: Length): Scene {
  const long = length !== "short";
  const t = (max: number, offset = 0) => text(language, length, max, offset);
  switch (template) {
    case "title":
      return narrated(
        language,
        2,
        (mark) => ({
          heading: t(limits.title.heading),
          headingTrigger: mark(0),
          ...(long
            ? {
                subheading: t(limits.title.subheading, 3),
                subheadingTrigger: mark(1),
                icon: "Smartphone",
              }
            : {}),
        }),
        "title",
      );
    case "bullets": {
      const n = long ? limits.bullets.max : limits.bullets.min;
      return narrated(
        language,
        n,
        (mark) => ({
          heading: t(limits.heading),
          items: Array.from({ length: n }, (_, i) => ({
            text: t(limits.bullets.text, i),
            trigger: mark(i),
            ...(long
              ? { icon: (["Wallet", "Building2", "Smartphone", "Shield", "Clock"] as const)[i] }
              : {}),
          })),
        }),
        "bullets",
      );
    }
    case "flowchart":
    case "cycle": {
      const n = long ? limits.flowchart.max : limits.flowchart.min;
      return narrated(
        language,
        n,
        (mark) => ({
          heading: t(limits.heading),
          layout: template === "cycle" ? "cycle" : "linear",
          steps: Array.from({ length: n }, (_, i) => ({
            label: t(limits.flowchart.label, i),
            trigger: mark(i),
            ...(long
              ? {
                  icon: (
                    ["Smartphone", "Globe", "Building2", "Check", "Wallet", "Repeat"] as const
                  )[i],
                }
              : {}),
          })),
        }),
        "flowchart",
      );
    }
    case "comparison": {
      const points = long ? limits.comparison.max : limits.comparison.min;
      const side = (
        first: number,
        mark: (i: number) => string,
        icon: "Banknote" | "Smartphone",
      ) => ({
        title: t(limits.comparison.title, first),
        titleTrigger: mark(first),
        ...(long ? { icon } : {}),
        points: Array.from({ length: points }, (_, i) => ({
          text: t(limits.comparison.point, first + i + 1),
          trigger: mark(first + i + 1),
        })),
      });
      return narrated(
        language,
        2 * (points + 1),
        (mark) => ({
          heading: t(limits.heading),
          left: side(0, mark, "Banknote"),
          right: side(points + 1, mark, "Smartphone"),
        }),
        "comparison",
      );
    }
  }
}

/** A one-scene video of the case, plus a closing scene (a spec has at least two). */
export function stillSpec(
  template: StillTemplate,
  language: Language,
  length: Length,
  format: VideoFormat,
  palette: Palette,
): VideoSpec {
  const main = stillScene(template, language, length);
  return videoSpec.parse({
    version: 1,
    format,
    title: "Vidcosmos stills",
    language,
    voice: {
      gender: "female",
      voiceId: "voice_female_1",
      model: "eleven_multilingual_v2",
      speed: 1,
    },
    theme: { palette, captionStyle: "highlight" },
    scenes: [main, { ...stillScene("title", language, "short"), id: "sc_end" }],
  });
}
