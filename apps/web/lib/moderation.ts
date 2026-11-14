// Moderation of what people type (SDD §15, API §5): topic, notes, titles and scripts are checked
// by the small model before they're saved. A refusal is `422 CONTENT_BLOCKED` with a neutral
// reason and its category; nothing is saved and nothing is charged. Every block is recorded in
// `moderation_events` (three in 24 hours flag the workspace for review).
//
// If moderation is unavailable (an error, or no answer in 5 seconds), the request goes ahead
// and the next AI step moderates instead (API §5: "If moderation is unavailable, the project is
// created and the first AI step moderates instead").
import "server-only";
import { type ObjectId, recordModeration } from "@vidcosmos/db";
import { moderate, type ModerationInput, type ModerationResult } from "@vidcosmos/pipeline";
import { ApiError } from "./api";
import { getDb } from "./db";
import { getLlm, recordLlmUsage } from "./llm";

export type { ModerationInput };

export type ModerationScope = { workspaceId: ObjectId; userId: ObjectId; projectId?: ObjectId };

export const moderationTimeoutMs = 5_000;

class ModerationTimeout extends Error {
  constructor() {
    super(`Moderation didn't answer within ${moderationTimeoutMs / 1000} s.`);
    this.name = "ModerationTimeout";
  }
}

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new ModerationTimeout()), ms);
  });
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Throws 422 CONTENT_BLOCKED when any input is refused. Skips empty text; lets the request
 * through when moderation is unavailable.
 */
export async function requireAllowed(
  scope: ModerationScope,
  inputs: (ModerationInput | null)[],
  options: { timeoutMs?: number } = {},
): Promise<void> {
  const texts = inputs.filter((i): i is ModerationInput => Boolean(i?.text.trim()));
  if (texts.length === 0) return;

  let result: ModerationResult;
  try {
    result = await withTimeout(
      moderate(getLlm("small"), texts, { onAttempt: recordLlmUsage(scope, "moderation") }),
      options.timeoutMs ?? moderationTimeoutMs,
    );
  } catch (error) {
    console.warn("[moderation] Unavailable; letting the request through.", error);
    return;
  }

  const checked = result.decision === "block" ? result.input : texts[0]!;
  try {
    await recordModeration(getDb(), {
      ...scope,
      inputKind: checked.kind,
      decision: result.decision,
      ...(result.decision === "block" ? { category: result.category, reason: result.reason } : {}),
      text: checked.text,
      model: result.model,
    });
  } catch (error) {
    console.error("[moderation] Couldn't record the decision", error);
  }

  if (result.decision === "block") {
    throw new ApiError("CONTENT_BLOCKED", result.reason, {
      details: { category: result.category },
    });
  }
}
