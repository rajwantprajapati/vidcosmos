/** @vidcosmos/pipeline — Pure pipeline logic: prompts, LLM calls, ElevenLabs, timing, captions, patching. */
export const packageName = "@vidcosmos/pipeline" as const;

export * from "./ideas.ts";
export * from "./llm/index.ts";
export * from "./script.ts";
export * from "./storyboard.ts";
