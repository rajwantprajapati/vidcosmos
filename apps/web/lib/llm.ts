// The LLM for this server (SDD §8): the stub, or Gemini or Claude as `LLM_PROVIDER` says, with
// the model names from the environment. "small" is the cheap model for moderation and captions.
// `recordLlmUsage` turns each call into a usage event with its cost (SDD §15).
import "server-only";
import { type ObjectId, recordUsage } from "@vidcosmos/db";
import {
  createAnthropicProvider,
  createGeminiProvider,
  createStubLlm,
  type LlmAttempt,
  llmCost,
  type LlmProvider,
} from "@vidcosmos/pipeline";
import type { UsageEvent } from "@vidcosmos/spec/collections";
import { env } from "@/env";
import { getDb } from "./db";
import { selectProvider } from "./providers";

export type LlmSize = "main" | "small";

// Kept on globalThis so hot reload in development reuses the clients.
const cache = globalThis as typeof globalThis & {
  __vidcosmosLlm?: Partial<Record<LlmSize, LlmProvider>>;
};

function createLlm(size: LlmSize): LlmProvider {
  return selectProvider(env, "llm", {
    stub: () => createStubLlm(),
    // The env schema requires the key (and, for Claude, the model) when the LLM is live.
    live: (live) =>
      live.LLM_PROVIDER === "claude"
        ? createAnthropicProvider({
            apiKey: live.ANTHROPIC_API_KEY ?? "",
            model:
              (size === "small" ? live.ANTHROPIC_MODEL_SMALL : undefined) ??
              live.ANTHROPIC_MODEL ??
              "",
          })
        : createGeminiProvider({
            apiKey: live.GEMINI_API_KEY ?? "",
            model: size === "small" ? live.GEMINI_MODEL_SMALL : live.GEMINI_MODEL,
          }),
  });
}

export function getLlm(size: LlmSize = "main"): LlmProvider {
  cache.__vidcosmosLlm ??= {};
  cache.__vidcosmosLlm[size] ??= createLlm(size);
  return cache.__vidcosmosLlm[size];
}

export type UsageScope = {
  workspaceId: ObjectId;
  userId?: ObjectId;
  projectId?: ObjectId;
  jobId?: ObjectId;
};

/**
 * An `onAttempt` that records each call as a usage event. The stub costs nothing and records
 * nothing. A failed write is logged, never passed on: cost tracking mustn't fail the request.
 */
export function recordLlmUsage(scope: UsageScope, operation: UsageEvent["operation"]) {
  return async (attempt: LlmAttempt): Promise<void> => {
    if (attempt.provider === "stub") return;
    const { costMicroUsd, priceVersion } = llmCost(
      attempt.model,
      attempt.inputTokens,
      attempt.outputTokens,
    );
    try {
      await recordUsage(getDb(), {
        ...scope,
        provider: attempt.provider,
        operation,
        model: attempt.model,
        units: { inputTokens: attempt.inputTokens, outputTokens: attempt.outputTokens },
        cached: false,
        costMicroUsd,
        priceVersion,
        attempt: attempt.attempt,
      });
    } catch (error) {
      console.error("[llm] Couldn't record a usage event", error);
    }
  };
}
