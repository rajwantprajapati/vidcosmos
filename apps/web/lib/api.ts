// The /api/v1 route wrapper (API §1, §2): session required, same-origin check on writes, JSON
// bodies validated with zod, and every error in the one envelope. F08 adds idempotency and the
// rest of the codes as their endpoints arrive.
import "server-only";
import { randomUUID } from "node:crypto";
import { ensureWorkspace, ObjectId } from "@vidcosmos/db";
import type { Workspace } from "@vidcosmos/spec/collections";
import type { z } from "zod";
import { env } from "@/env";
import { auth, type Session } from "./auth";
import { getDb } from "./db";

export type ApiErrorCode =
  | "VALIDATION_FAILED"
  | "UNAUTHENTICATED"
  | "CSRF_ORIGIN"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "PAYLOAD_TOO_LARGE"
  | "INTERNAL";

const statusOf: Record<ApiErrorCode, number> = {
  VALIDATION_FAILED: 400,
  UNAUTHENTICATED: 401,
  CSRF_ORIGIN: 403,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  PAYLOAD_TOO_LARGE: 413,
  INTERNAL: 500,
};

const messages: Record<ApiErrorCode, string> = {
  VALIDATION_FAILED: "Some of what was sent isn't valid.",
  UNAUTHENTICATED: "Sign in to continue.",
  CSRF_ORIGIN: "This request came from another site, so it was refused.",
  FORBIDDEN: "You can't do that.",
  NOT_FOUND: "That doesn't exist.",
  PAYLOAD_TOO_LARGE: "That's too much to send at once.",
  INTERNAL: "Something went wrong on our side. Try again in a moment.",
};

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly fields?: { path: string; message: string }[];
  constructor(code: ApiErrorCode, message = messages[code], fields?: ApiError["fields"]) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.fields = fields;
  }
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
    throw new ApiError("VALIDATION_FAILED", undefined, [
      { path: operator, message: "Field names can't start with $ or contain a dot." },
    ]);
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError(
      "VALIDATION_FAILED",
      undefined,
      parsed.error.issues.map((issue) => ({
        path: issue.path.map(String).join("."),
        message: issue.message,
      })),
    );
  }
  return parsed.data;
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
        retryable: error.code === "INTERNAL",
        ...(error.fields ? { fields: error.fields } : {}),
        requestId,
      },
    },
    { status: statusOf[error.code] },
  );
}

const appOrigin = new URL(env.BETTER_AUTH_URL).origin;

/** Wraps a route handler; the handler returns a Response or a JSON body (200). */
export function apiRoute(handler: (context: ApiContext) => Promise<Response | object>) {
  return async (request: Request): Promise<Response> => {
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
      const result = await handler({ request, requestId, session, userId, workspace });
      response = result instanceof Response ? result : Response.json(result);
    } catch (error) {
      if (!(error instanceof ApiError)) console.error(`[api ${requestId}]`, error);
      response = errorResponse(
        error instanceof ApiError ? error : new ApiError("INTERNAL"),
        requestId,
      );
    }
    response.headers.set("X-Request-Id", requestId);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  };
}
