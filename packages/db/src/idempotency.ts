// Idempotency keys for creates (API §1 "Idempotency"). The first request with a key does the
// work and records what it created; the same key within 24 hours returns that again; the
// same key with a different body is refused. Two requests racing with one key: the second
// is told the first is still running.
import { createHash } from "node:crypto";
import { type Db, ObjectId } from "mongodb";
import { workspaceCollection } from "./scoped.ts";

export const idempotencyTtlMs = 24 * 60 * 60 * 1000;

export type IdempotencyErrorCode = "IDEMPOTENCY_MISMATCH" | "IDEMPOTENCY_IN_PROGRESS";

export class IdempotencyError extends Error {
  readonly code: IdempotencyErrorCode;
  constructor(code: IdempotencyErrorCode, message: string) {
    super(message);
    this.name = "IdempotencyError";
    this.code = code;
  }
}

/** JSON with sorted keys, so the same body hashes the same whatever its key order. */
function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)))
      : v,
  );
}

export const bodyHash = (body: unknown) =>
  createHash("sha256")
    .update(canonical(body ?? null))
    .digest("hex");

export type Created = { status: number; resourceId: ObjectId };

/**
 * Runs `create` once per key. Returns what it created, and whether this was a replay of an
 * earlier request.
 */
export async function withIdempotency(
  db: Db,
  request: { workspaceId: ObjectId; key: string; route: string; body: unknown },
  create: () => Promise<Created>,
  now = new Date(),
): Promise<Created & { replayed: boolean }> {
  const keys = workspaceCollection(db, "idempotency_keys");
  const hash = bodyHash(request.body);
  const rowId = new ObjectId();
  try {
    await keys.insertOne({
      _id: rowId,
      schemaVersion: 1,
      workspaceId: request.workspaceId,
      key: request.key,
      route: request.route,
      bodyHash: hash,
      status: "pending",
      createdAt: now,
      expiresAt: new Date(now.getTime() + idempotencyTtlMs),
    });
  } catch (error) {
    if ((error as { code?: number }).code !== 11000) throw error;
    const existing = await keys.findOne({ workspaceId: request.workspaceId, key: request.key });
    if (!existing) throw error;
    if (existing.route !== request.route || existing.bodyHash !== hash) {
      throw new IdempotencyError(
        "IDEMPOTENCY_MISMATCH",
        "This Idempotency-Key was already used for a different request.",
      );
    }
    if (existing.status !== "done" || !existing.result) {
      throw new IdempotencyError(
        "IDEMPOTENCY_IN_PROGRESS",
        "The same request is still being handled. Try again in a moment.",
      );
    }
    return { ...existing.result, replayed: true };
  }

  try {
    const created = await create();
    await keys.updateOne(
      { workspaceId: request.workspaceId, _id: rowId },
      { $set: { status: "done", result: created } },
    );
    return { ...created, replayed: false };
  } catch (error) {
    // A failed request didn't happen: the same key can be tried again.
    await keys.deleteOne({ workspaceId: request.workspaceId, _id: rowId });
    throw error;
  }
}
