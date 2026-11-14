// Claude through the Messages API with a JSON-schema structured output (SDD §8). The prototype
// forced a tool call; current Claude models (Sonnet 5.5, Opus 5.5) reject forced tool use with a
// 400, so the answer is requested as JSON output instead. The SDK retries 429 and 5xx itself,
// honouring retry-after. On models that support it, Claude's server-side fallback re-runs a
// declined request on another model inside the same call; a decline that stands is a refusal.
import Anthropic from "@anthropic-ai/sdk";
import {
  type LlmProvider,
  LlmError,
  type StructuredRequest,
  type StructuredResponse,
} from "./provider.ts";
import { toClaudeSchema } from "./schema.ts";

export type AnthropicOptions = {
  apiKey: string;
  model: string;
  maxRetries?: number;
  /** For tests: the HTTP client the SDK uses. */
  fetch?: typeof fetch;
};

/** Models that accept `fallbacks: "default"` (beta `server-side-fallback-2026-07-01`). */
const fallbackModels = new Set([
  "claude-fable-5-2",
  "claude-fable-5-1",
  "claude-opus-5-5",
  "claude-opus-5",
  "claude-sonnet-5-5",
]);
const fallbackBeta = "server-side-fallback-2026-07-01";

type Reply = {
  model: string;
  stop_reason: string | null;
  stop_details?: { category?: string | null } | null;
  content: Array<{ type: string; text?: string }>;
  usage: { input_tokens: number; output_tokens: number };
};

export function createAnthropicProvider(options: AnthropicOptions): LlmProvider {
  const client = new Anthropic({
    apiKey: options.apiKey,
    maxRetries: options.maxRetries ?? 4,
    ...(options.fetch ? { fetch: options.fetch } : {}),
  });

  async function send(request: StructuredRequest): Promise<Reply> {
    const params = {
      model: options.model,
      max_tokens: request.maxTokens,
      system: `${request.system}\n\nRespond with one JSON object: ${request.description}`,
      messages: [{ role: "user" as const, content: request.prompt }],
      output_config: {
        format: {
          type: "json_schema" as const,
          schema: toClaudeSchema(request.jsonSchema) as Record<string, unknown>,
        },
        ...(request.effort ? { effort: request.effort } : {}),
      },
    };
    try {
      if (fallbackModels.has(options.model)) {
        return (await client.beta.messages.create({
          ...params,
          betas: [fallbackBeta],
          fallbacks: "default",
        })) as unknown as Reply;
      }
      return (await client.messages.create(params)) as unknown as Reply;
    } catch (error) {
      if (error instanceof Anthropic.RateLimitError) {
        throw new LlmError("LLM_RATE_LIMITED", "Claude's rate limit was reached.", {
          cause: error,
        });
      }
      if (
        error instanceof Anthropic.InternalServerError ||
        error instanceof Anthropic.APIConnectionError
      ) {
        throw new LlmError("LLM_UNAVAILABLE", "Claude didn't answer.", { cause: error });
      }
      throw error;
    }
  }

  return {
    name: "anthropic",
    model: options.model,
    async generate(request: StructuredRequest): Promise<StructuredResponse> {
      const reply = await send(request);
      const tokens = {
        model: reply.model,
        inputTokens: reply.usage.input_tokens,
        outputTokens: reply.usage.output_tokens,
      };
      // Check the stop reason before reading content: a refusal may not match the schema.
      if (reply.stop_reason === "refusal") {
        return { output: null, ...tokens, refusal: reply.stop_details?.category ?? "refusal" };
      }
      const text = reply.content
        .filter((block) => block.type === "text")
        .map((block) => block.text ?? "")
        .join("");
      let output: unknown = null;
      try {
        output = text ? JSON.parse(text) : null;
      } catch {
        output = null; // e.g. cut off at max_tokens: callStructured asks again.
      }
      return { output, ...tokens };
    },
  };
}
