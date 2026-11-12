// The /api/v1 route wrapper (API §1, §2): session required, same-origin check on writes, JSON
// bodies and queries validated with zod, and every error in the one envelope with its code,
// details and request id. Codes for later features join this list with their endpoints.
import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { ensureWorkspace, IdempotencyError, ObjectId, ProjectError } from "@vidcosmos/db";
import type { Workspace } from "@vidcosmos/spec/collections";
import type { z } from "zod";
import { env } from "@/env";
import { auth, type Session } from "./auth";
import { getDb } from "./db";

const errors = {
  VALIDATION_FAILED: { status: 400, message: "Some of what was sent isn't valid." },
  INVALID_CURSOR: { status: 400, message: "This page link doesn't work any more." },
  UNAUTHENTICATED: { status: 401, message: "Sign in to continue." },
  CSRF_ORIGIN: { status: 403, message: "This request came from another site, so it was refused." },
  FORBIDDEN: { status: 403, message: "You can't do that." },
  NOT_FOUND: { status: 404, message: "That doesn't exist." },
  REV_CONFLICT: { status: 409, message: "This video changed in another place." },
  STAGE_INVALID: { status: 409, message: "That can't be done at this step." },
  // Not in API §2: two requests with one Idempotency-Key at once (decision log, 12 Nov).
  IDEMPOTENCY_IN_PROGRESS: { status: 409, message: "The same request is still being handled." },
  PAYLOAD_TOO_LARGE: { status: 413, message: "That's too much to send at once." },
  IDEMPOTENCY_MISMATCH: {
    status: 422,
    message: "This Idempotency-Key was already used for a different request.",
  },
  CONTENT_BLOCKED: { status: 422, message: "This can't be made into a video." },
  LEASE_HELD: { status: 423, message: "This video is open for editing somewhere else." },
  INTERNAL: { status: 500, message: "Something went wrong on our side. Try again in a moment." },
} as const satisfies Record<string, { status: number; message: string }>;

export type ApiErrorCode = keyof typeof errors;

/** Worth sending the same request again later. */
const retryable = new Set<ApiErrorCode>(["INTERNAL", "IDEMPOTENCY_IN_PROGRESS"]);

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly fields?: { path: string; message: string }[];
  readonly details?: Record<string, unknown>;
  constructor(
    code: ApiErrorCode,
    message: string = errors[code].message,
    extra: { fields?: ApiError["fields"]; details?: Record<string, unknown> } = {},
  ) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.fields = extra.fields;
    this.details = extra.details;
  }
}

/** Domain refusals from the database layer, as API errors. */
function toApiError(error: unknown): ApiError | null {
  if (error instanceof ApiError) return error;
  if (error instanceof ProjectError || error instanceof IdempotencyError) {
    return new ApiError(error.code, error.message, {
      details: error instanceof ProjectError ? error.details : undefined,
    });
  }
  return null;
}

const maxBodyBytes = 256 * 1024;

/** Keys that could act as MongoDB operators or paths are refused (DB §13). */
function findOperatorKey(value: unknown, path = ""): string | null {
  if (Array.isArray(value)) {
    for (const [i, item] of value.entries()) {
      const found = findOperatorKey(item, `${path}[${i}]`);
      if (found) return found;
    }
  } else if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      if (key.startsWith("$") || key.includes(".")) return path ? `${path}.${key}` : key;
      const found = findOperatorKey(item, path ? `${path}.${key}` : key);
      if (found) return found;
    }
  }
  return null;
}

/** Reads and validates a JSON body. */
export async function readJson<S extends z.ZodType>(
  request: Request,
  schema: S,
): Promise<z.output<S>> {
  const text = await request.text();
  if (new TextEncoder().encode(text).length > maxBodyBytes) throw new ApiError("PAYLOAD_TOO_LARGE");
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : undefined;
  } catch {
    throw new ApiError("VALIDATION_FAILED", "The request body isn't valid JSON.");
  }
  const operator = findOperatorKey(body);
  if (operator) {
    throw new ApiError("VALIDATION_FAILED", undefined, {
      fields: [{ path: operator, message: "Field names can't start with $ or contain a dot." }],
    });
  }
  return validate(schema, body);
}

function validate<S extends z.ZodType>(schema: S, value: unknown): z.output<S> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new ApiError("VALIDATION_FAILED", undefined, {
      fields: parsed.error.issues.map((issue) => ({
        path: issue.path.map(String).join("."),
        message: issue.message,
      })),
    });
  }
  return parsed.data;
}

/** Reads and validates the query string; a repeated parameter becomes a list. */
export function readQuery<S extends z.ZodType>(request: Request, schema: S): z.output<S> {
  const query: Record<string, string | string[]> = {};
  for (const [key, value] of new URL(request.url).searchParams) {
    const existing = query[key];
    query[key] = existing === undefined ? value : [...[existing].flat(), value];
  }
  return validate(schema, query);
}

/**
 * A JSON response with an ETag (API §1 "Caching"). A request whose If-None-Match matches gets
 * `304 Not Modified` without a body. The tag is a hash of the body, so it changes with
 * anything the caller can see (the rev, the lease, a job's progress).
 */
export function withETag(request: Request, body: object): Response {
  const etag = `"${createHash("sha256").update(JSON.stringify(body)).digest("base64url").slice(0, 27)}"`;
  const headers = { ETag: etag, "Cache-Control": "private, no-cache" };
  const sent = request.headers.get("if-none-match");
  // "*" matches any current version of the resource (RFC 9110).
  const matches = sent
    ?.split(",")
    .some((tag) => tag.trim() === "*" || tag.trim().replace(/^W\//, "") === etag);
  if (matches) {
    return new Response(null, { status: 304, headers });
  }
  return Response.json(body, { headers });
}

/** The editor tab's id (`X-Editor-Id`), which holds the edit lease with the session (API §5). */
export function editorId(request: Request): string {
  const value = request.headers.get("x-editor-id")?.trim();
  if (!value || value.length > 100) {
    throw new ApiError("VALIDATION_FAILED", undefined, {
      fields: [{ path: "X-Editor-Id", message: "Send the editor tab's id in X-Editor-Id." }],
    });
  }
  return value;
}

/** The `Idempotency-Key` header (API §1): a UUID per user action. */
export function idempotencyKey(request: Request, required: boolean): string | null {
  const value = request.headers.get("idempotency-key")?.trim();
  if (value && value.length <= 255) return value;
  if (!required && !value) return null;
  throw new ApiError("VALIDATION_FAILED", undefined, {
    fields: [
      { path: "Idempotency-Key", message: "Send a unique Idempotency-Key with this request." },
    ],
  });
}

export type ApiContext = {
  request: Request;
  requestId: string;
  session: Session;
  userId: ObjectId;
  workspace: Workspace;
};

function errorResponse(error: ApiError, requestId: string) {
  return Response.json(
    {
      error: {
        code: error.code,
        message: error.message,
        retryable: retryable.has(error.code),
        ...(error.details ? { details: error.details } : {}),
        ...(error.fields ? { fields: error.fields } : {}),
        requestId,
      },
    },
    { status: errors[error.code].status },
  );
}

const appOrigin = new URL(env.BETTER_AUTH_URL).origin;

/**
 * Wraps a route handler; the handler returns a Response or a JSON body (200). `P` is the
 * route's path parameters, e.g. `{ id: string }`.
 */
export function apiRoute<P extends Record<string, string> = Record<string, never>>(
  handler: (context: ApiContext & { params: P }) => Promise<Response | object>,
) {
  return async (request: Request, route?: { params: Promise<P> }): Promise<Response> => {
    const requestId = randomUUID();
    let response: Response;
    try {
      if (request.method !== "GET" && request.method !== "HEAD") {
        if (request.headers.get("origin") !== appOrigin) throw new ApiError("CSRF_ORIGIN");
      }
      const session = await auth.api.getSession({ headers: request.headers });
      if (!session) throw new ApiError("UNAUTHENTICATED");
      const userId = new ObjectId(session.user.id);
      const workspace = await ensureWorkspace(getDb(), { id: userId, name: session.user.name });
      const params = (route ? await route.params : {}) as P;
      const result = await handler({ request, requestId, session, userId, workspace, params });
      response = result instanceof Response ? result : Response.json(result);
    } catch (error) {
      const known = toApiError(error);
      if (!known) console.error(`[api ${requestId}]`, error);
      response = errorResponse(known ?? new ApiError("INTERNAL"), requestId);
    }
    response.headers.set("X-Request-Id", requestId);
    // A route with an ETag sets its own (private, revalidated) caching; all others: none.
    if (!response.headers.has("Cache-Control")) {
      response.headers.set("Cache-Control", "private, no-store");
    }
    return response;
  };
}
