// Asks an LLM for JSON matching a zod schema, validates it (schema plus semantic checks) and, on
// failure, asks again with the previous answer and its problems, up to 3 attempts (SDD §8).
// Works the same for every provider: each attempt is one self-contained request. Every attempt
// is reported through `onAttempt`, so each one becomes a usage event with its tokens and cost.
import type { z } from "zod";
import { type LlmEffort, LlmError, type LlmProvider } from "./provider.ts";
import { toJsonSchema } from "./schema.ts";

export type LlmAttempt = {
  provider: LlmProvider["name"];
  model: string;
  inputTokens: number;
  outputTokens: number;
  /** 1 for the first try, 2+ for retries (DB §4). */
  attempt: number;
};

export type StructuredCall<T> = {
  llm: LlmProvider;
  system: string;
  prompt: string;
  name: string;
  description: string;
  schema: z.ZodType<T>;
  /** Fields the pipeline fills in later, left out of what the model sees. */
  omitFields?: readonly string[];
  /** Checks JSON Schema can't express; each string is one problem fed back to the model. */
  semanticCheck?: (value: T) => string[];
  maxAttempts?: number;
  maxTokens?: number;
  effort?: LlmEffort;
  onAttempt?: (attempt: LlmAttempt) => void | Promise<void>;
};

export type StructuredResult<T> = {
  value: T;
  attempts: number;
  /** Problems seen on earlier attempts (and semantic problems left on the last one). */
  issues: string[];
};

export async function callStructured<T>(call: StructuredCall<T>): Promise<StructuredResult<T>> {
  const jsonSchema = toJsonSchema(call.schema, call.omitFields);
  const maxAttempts = call.maxAttempts ?? 3;
  const seen: string[] = [];
  let prompt = call.prompt;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const response = await call.llm.generate({
      system: call.system,
      prompt,
      name: call.name,
      description: call.description,
      jsonSchema,
      maxTokens: call.maxTokens ?? 4096,
      effort: call.effort,
    });
    await call.onAttempt?.({
      provider: call.llm.name,
      model: response.model,
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
      attempt,
    });
    if (response.refusal) {
      throw new LlmError(
        "CONTENT_BLOCKED",
        `The model declined this request (${response.refusal}).`,
      );
    }

    const parsed = response.output === null ? null : call.schema.safeParse(response.output);
    const issues =
      parsed === null
        ? ["The answer was empty or not valid JSON. Return one complete JSON object."]
        : parsed.success
          ? (call.semanticCheck?.(parsed.data) ?? [])
          : parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`);

    if (parsed?.success && issues.length === 0)
      return { value: parsed.data, attempts: attempt, issues: seen };
    seen.push(...issues.map((issue) => `attempt ${attempt}: ${issue}`));

    if (attempt === maxAttempts) {
      // Schema-valid but semantically imperfect is still usable; later steps have fallbacks.
      if (parsed?.success) return { value: parsed.data, attempts: attempt, issues: seen };
      throw new LlmError(
        "LLM_INVALID_OUTPUT",
        `${call.name}: no valid output after ${maxAttempts} attempts. ${issues.slice(0, 5).join(" ")}`,
      );
    }
    const previous =
      response.output === null
        ? "(no valid JSON)"
        : JSON.stringify(response.output).slice(0, 12_000);
    prompt = `${call.prompt}

Your previous answer was:
${previous}

It had these problems:
- ${issues.slice(0, 20).join("\n- ")}

Return the complete corrected result.`;
  }
  throw new Error("unreachable");
}
