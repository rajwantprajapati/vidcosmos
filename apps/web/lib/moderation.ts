// Moderation of what people type (API §5: topic, notes, titles and scripts are checked before
// they are saved). Until LLM providers and moderation land (F13), everything is allowed.
import "server-only";
import { ApiError } from "./api";

export type ModerationInput = {
  kind: "topic" | "notes" | "script" | "scene_text" | "chat" | "caption";
  text: string;
};

export type ModerationDecision =
  { decision: "allow" } | { decision: "block"; category: string; reason: string };

export interface Moderator {
  check(inputs: ModerationInput[]): Promise<ModerationDecision>;
}

/** The stub: allows everything. F13 adds the small-model check (5 s timeout, fail open). */
export const moderator: Moderator = {
  async check() {
    return { decision: "allow" };
  },
};

/** Throws 422 CONTENT_BLOCKED when any input is refused; skips empty text. */
export async function requireAllowed(inputs: (ModerationInput | null)[]) {
  const texts = inputs.filter((i): i is ModerationInput => Boolean(i?.text.trim()));
  if (texts.length === 0) return;
  const result = await moderator.check(texts);
  if (result.decision === "block") {
    throw new ApiError("CONTENT_BLOCKED", result.reason, {
      details: { category: result.category },
    });
  }
}
