// One way to call an LLM, whichever provider is set (SDD §8 "LLM providers"). Each provider takes
// a JSON Schema and returns an object that should match it; `callStructured` validates it with
// zod either way, so providers stay thin and interchangeable. Ported from the prototype.

export type LlmProviderName = "gemini" | "anthropic" | "stub";

/** How hard the model thinks: Gemini's thinking level, Claude's effort. Unset: the model's default. */
export type LlmEffort = "low" | "medium" | "high";

export type StructuredRequest = {
  system: string;
  prompt: string;
  /** Short name for the output, e.g. "submit_script" or "classify_content". */
  name: string;
  /** What the JSON object is, e.g. "the finished narration script". */
  description: string;
  jsonSchema: Record<string, unknown>;
  maxTokens: number;
  effort?: LlmEffort;
};

export type StructuredResponse = {
  /** Parsed JSON, or null when the model returned nothing parseable. */
  output: unknown;
  /** The model that answered (it can differ from the one asked when a fallback ran). */
  model: string;
  inputTokens: number;
  /** Includes thinking tokens, which are billed as output. */
  outputTokens: number;
  /** Set when the model declined for safety reasons; `output` is then null. */
  refusal?: string;
};

export interface LlmProvider {
  readonly name: LlmProviderName;
  readonly model: string;
  generate(request: StructuredRequest): Promise<StructuredResponse>;
}

/** The job error codes an LLM call can end with (API §2 "Job errors"). */
export type LlmErrorCode =
  "LLM_INVALID_OUTPUT" | "LLM_RATE_LIMITED" | "LLM_UNAVAILABLE" | "CONTENT_BLOCKED";

const retryableCodes = new Set<LlmErrorCode>([
  "LLM_INVALID_OUTPUT",
  "LLM_RATE_LIMITED",
  "LLM_UNAVAILABLE",
]);

export class LlmError extends Error {
  readonly code: LlmErrorCode;
  readonly retryable: boolean;
  constructor(code: LlmErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "LlmError";
    this.code = code;
    this.retryable = retryableCodes.has(code);
  }
}

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
