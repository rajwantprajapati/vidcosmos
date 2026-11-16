// The VideoSpec (DB §6): the video itself. The editor edits it, the Player plays it, the
// renderer renders it, revisions change it and versions keep copies of it. Stored inside
// `projects.draft.spec` and `project_versions.spec`, never on its own.
//
// Scenes are a union on `template`; each template's fields sit under `content`, as in the
// prototype. `timing` is null until the scene's narration is recorded.
import { z } from "zod";
import {
  captionStyle,
  language,
  palette,
  videoFormat,
  voiceGender,
  voiceSpeed,
} from "../collections/common.ts";
import { controlCharacterMessage, isPlainText } from "../api/text.ts";
import { lineText, templateContent, type TemplateName } from "./templates.ts";

/** The only ElevenLabs model in V1 (PRD FR-5.1). */
export const voiceModel = z.literal("eleven_multilingual_v2");

export const specVoice = z.object({
  gender: voiceGender,
  /** The ElevenLabs voice id. */
  voiceId: z.string().min(1).max(64),
  model: voiceModel,
  speed: voiceSpeed,
});
export type SpecVoice = z.infer<typeof specVoice>;

export const specTheme = z.object({ palette, captionStyle });

/** Background music; ducked to a quarter under speech when `duck` is on. */
export const specMusic = z.object({
  trackId: z.string().min(1).max(64),
  volume: z.number().min(0).max(1),
  duck: z.boolean(),
});

export const spokenWord = z.object({
  text: z.string(),
  startMs: z.number().min(0),
  endMs: z.number().min(0),
});

export const sceneTiming = z
  .object({
    /** `assets._id` as hex, never a URL: links are signed when the spec is sent out. */
    narrationAssetId: z.string().regex(/^[0-9a-f]{24}$/),
    /** `narrationHash(...)` of the narration and voice this audio was made from. */
    narrationHash: z.string().regex(/^[0-9a-f]{64}$/),
    audioDurationMs: z.number().positive(),
    leadInMs: z.number().min(0),
    /** Lead-in + audio + tail. */
    durationMs: z.number().positive(),
    words: z.array(spokenWord),
    /** `estimated` only with the development voice. */
    timingSource: z.enum(["provider", "estimated"]),
  })
  .refine((t) => t.durationMs >= t.leadInMs + t.audioDurationMs, {
    message: "A scene lasts at least its lead-in plus its audio.",
    path: ["durationMs"],
  })
  .refine(
    (t) =>
      t.words.every(
        (word, i) =>
          word.endMs >= word.startMs && (i === 0 || word.startMs >= t.words[i - 1]!.startMs),
      ),
    {
      message: "Each word ends after it starts, and words come in the order they're spoken.",
      path: ["words"],
    },
  );
export type SceneTiming = z.infer<typeof sceneTiming>;

/** A new scene's id: "sc_" and 8 random characters. Stable across revisions. */
export const sceneId = z
  .string()
  .min(1)
  .max(40)
  .regex(/^[A-Za-z0-9_-]+$/);

const sceneBase = {
  id: sceneId,
  /** What the narrator says in this scene. Line breaks are allowed; control characters aren't. */
  narration: z.string().trim().min(1).max(400).refine(isPlainText(true), controlCharacterMessage),
  /** True once the user edits the scene by hand: whole-video rewrites ask before replacing it. */
  userEdited: z.boolean().default(false),
  timing: sceneTiming.nullable().default(null),
};

const sceneOf = <T extends TemplateName>(template: T) =>
  z.object({ ...sceneBase, template: z.literal(template), content: templateContent[template] });

export const scene = z.discriminatedUnion("template", [
  sceneOf("title"),
  sceneOf("bullets"),
  sceneOf("keyTerm"),
  sceneOf("flowchart"),
  sceneOf("comparison"),
  sceneOf("timeline"),
  sceneOf("barChart"),
  sceneOf("pieChart"),
  sceneOf("iconGrid"),
  sceneOf("statCallout"),
  sceneOf("quiz"),
  sceneOf("recap"),
]);
export type Scene = z.infer<typeof scene>;
/** A scene as written before parsing: `userEdited` and `timing` may be left out. */
export type SceneInput = z.input<typeof scene>;

export const minScenes = 2;
export const maxScenes = 10;

export const videoSpec = z.object({
  version: z.literal(1),
  /** Missing in prototype specs: `migrateSpec` reads them as "9:16". */
  format: videoFormat,
  title: lineText(100),
  language,
  voice: specVoice,
  theme: specTheme,
  music: specMusic.nullable().default(null),
  scenes: z.array(scene).min(minScenes).max(maxScenes),
});
export type VideoSpec = z.infer<typeof videoSpec>;
export type VideoSpecInput = z.input<typeof videoSpec>;

// ---- Formats and timing ----

export type FormatInfo = {
  /** Canvas at 1080p and at 720p, in px. */
  width: number;
  height: number;
  width720: number;
  height720: number;
  /** Kept clear of text, as fractions of the canvas (DB §6 "Formats"). */
  safe: { top: number; bottom: number; left: number; right: number };
};

export const formats: Record<z.infer<typeof videoFormat>, FormatInfo> = {
  "9:16": {
    width: 1080,
    height: 1920,
    width720: 720,
    height720: 1280,
    // Instagram's and Shorts' buttons sit at the top, bottom and right.
    safe: { top: 0.14, bottom: 0.2, left: 0.06, right: 0.06 },
  },
  "16:9": {
    width: 1920,
    height: 1080,
    width720: 1280,
    height720: 720,
    safe: { top: 0.05, bottom: 0.05, left: 0.05, right: 0.05 },
  },
  "1:1": {
    width: 1080,
    height: 1080,
    width720: 720,
    height720: 720,
    safe: { top: 0.05, bottom: 0.05, left: 0.05, right: 0.05 },
  },
};

export const videoTiming = {
  fps: 30,
  /** Silence before each scene's narration and after it (PRD FR-5.5). */
  leadInMs: 300,
  tailMs: 400,
  /** A whole video, once every scene has timing (DB §6). */
  minTotalMs: 20_000,
  maxTotalMs: 100_000,
} as const;

export const msToFrame = (ms: number) => Math.round((ms / 1000) * videoTiming.fps);
