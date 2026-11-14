// Gemini through `generateContent` with a JSON response schema (SDD §8). Ported from the
// prototype. The free tier has low per-minute limits, so 429s and 5xx wait and try again
// (5-60 s), then fail with a clear error.
import { ApiError, GoogleGenAI, type ThinkingLevel } from "@google/genai";
import {
  type LlmProvider,
  LlmError,
  sleep,
  type StructuredRequest,
  type StructuredResponse,
} from "./provider.ts";
import { toGeminiSchema } from "./schema.ts";

export type GeminiOptions = {
  apiKey: string;
  model: string;
  /** Waits between retries of a 429 or 5xx, in ms. Tests pass zeros. */
  retryWaitsMs?: readonly number[];
};

const thinkingLevels = { low: "LOW", medium: "MEDIUM", high: "HIGH" } as const;

/** Finish reasons that mean Gemini's safety filters stopped the answer. */
const safetyStops = new Set(["SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST", "SPII", "IMAGE_SAFETY"]);

export function createGeminiProvider(options: GeminiOptions): LlmProvider {
  const client = new GoogleGenAI({ apiKey: options.apiKey });
  const waits = options.retryWaitsMs ?? [5_000, 15_000, 30_000, 60_000];

  async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await fn();
      } catch (error) {
        const status = error instanceof ApiError ? error.status : undefined;
        const retryable = status === 429 || (status !== undefined && status >= 500);
        if (retryable && attempt < waits.length) {
          await sleep(waits[attempt]!);
          continue;
        }
        if (status === 429) {
          throw new LlmError(
            "LLM_RATE_LIMITED",
            `Gemini's rate limit was reached after ${attempt + 1} tries. The free tier allows a few requests a minute and a daily cap.`,
            { cause: error },
          );
        }
        if (status !== undefined && status >= 500) {
          throw new LlmError(
            "LLM_UNAVAILABLE",
            `Gemini answered ${status} after ${attempt + 1} tries.`,
            {
              cause: error,
            },
          );
        }
        throw error;
      }
    }
  }

  return {
    name: "gemini",
    model: options.model,
    async generate(request: StructuredRequest): Promise<StructuredResponse> {
      const response = await withRetry(() =>
        client.models.generateContent({
          model: options.model,
          contents: request.prompt,
          config: {
            systemInstruction: `${request.system}\n\nRespond with one JSON object: ${request.description}`,
            responseMimeType: "application/json",
            responseJsonSchema: toGeminiSchema(request.jsonSchema),
            maxOutputTokens: request.maxTokens,
            ...(request.effort
              ? {
                  thinkingConfig: {
                    thinkingLevel: thinkingLevels[request.effort] as ThinkingLevel,
                  },
                }
              : {}),
          },
        }),
      );
      const usage = response.usageMetadata;
      const tokens = {
        inputTokens: usage?.promptTokenCount ?? 0,
        // Gemini 3 models think before answering; thinking tokens are billed as output.
        outputTokens: (usage?.candidatesTokenCount ?? 0) + (usage?.thoughtsTokenCount ?? 0),
      };
      const blocked = response.promptFeedback?.blockReason;
      const finish = response.candidates?.[0]?.finishReason;
      if (blocked || (finish && safetyStops.has(finish))) {
        return {
          output: null,
          model: options.model,
          ...tokens,
          refusal: String(blocked ?? finish),
        };
      }
      let output: unknown = null;
      try {
        output = response.text ? JSON.parse(response.text) : null;
      } catch {
        output = null; // Truncated or malformed JSON: callStructured asks again with feedback.
      }
      return { output, model: options.model, ...tokens };
    },
  };
}
