// The refusals of job and usage rules, which the API turns into its error envelope (API §2).
// Its own module so `jobs.ts` and `usage.ts` can both use it.
export type JobErrorCode =
  | "NOT_FOUND"
  | "INVALID_CURSOR"
  | "JOB_IN_PROGRESS"
  | "LIMIT_REACHED"
  | "NOT_CANCELLABLE"
  | "NOT_RETRYABLE"
  | "WORKSPACE_BLOCKED";

/** A refusal the API turns into its error envelope (API §2). */
export class JobError extends Error {
  readonly code: JobErrorCode;
  readonly details?: Record<string, unknown>;
  constructor(code: JobErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "JobError";
    this.code = code;
    this.details = details;
  }
}
