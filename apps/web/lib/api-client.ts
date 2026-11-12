// Calls to /api/v1 from the browser. Same origin, so the session cookie and the Origin header
// go with every request. Errors come back as their user-facing message (API §2).
export class ApiRequestError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: Record<string, unknown>;
  constructor(status: number, code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export async function apiFetch<T = unknown>(
  path: string,
  init: { method?: string; body?: unknown; idempotent?: boolean } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  if (init.body !== undefined) headers["Content-Type"] = "application/json";
  // One key per user action: a retried request can't create twice (API §1).
  if (init.idempotent) headers["Idempotency-Key"] = crypto.randomUUID();
  // A path under /api/ is used as it is (the development routes in /api/dev).
  const response = await fetch(path.startsWith("/api/") ? path : `/api/v1${path}`, {
    method: init.method ?? "GET",
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  if (response.status === 204) return undefined as T;
  const payload = (await response.json().catch(() => null)) as
    (T & { error?: { code: string; message: string; details?: Record<string, unknown> } }) | null;
  if (!response.ok) {
    throw new ApiRequestError(
      response.status,
      payload?.error?.code ?? "INTERNAL",
      payload?.error?.message ?? "Something went wrong. Try again in a moment.",
      payload?.error?.details,
    );
  }
  return payload as T;
}
