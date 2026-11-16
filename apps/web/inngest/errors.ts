// How an LLM failure reads on the job (API §2 "Job errors"): the code, a message for the person
// and whether "Try again" makes sense. Anything else is a bug: Inngest retries the run, then
// `onFailure` marks it INTERNAL.
import { LlmError } from "@vidcosmos/pipeline";

export type JobErrorInfo = { code: string; message: string; retryable: boolean };

/** What the step was doing, for LLM_INVALID_OUTPUT, e.g. "suggest angles" or "write the script". */
export function llmJobError(error: LlmError, what: string): JobErrorInfo {
  const message = {
    LLM_INVALID_OUTPUT: `The AI couldn't ${what} this time. Try again.`,
    LLM_RATE_LIMITED: "The AI service is busy. Try again in a minute.",
    LLM_UNAVAILABLE: "The AI service is having trouble. Try again shortly.",
    CONTENT_BLOCKED: "This can't be made into a video.",
  }[error.code];
  return { code: error.code, message, retryable: error.retryable };
}

export const isLlmError = (error: unknown): error is LlmError => error instanceof LlmError;
