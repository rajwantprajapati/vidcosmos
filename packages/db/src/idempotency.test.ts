// F08: idempotent create. The same key replays the first result; a different body is refused;
// a request still running is reported; a failure frees the key.
import { ObjectId } from "mongodb";
import { beforeAll, describe, expect, it } from "vitest";
import { IdempotencyError, withIdempotency } from "./idempotency.ts";
import { migrate } from "./migrate.ts";
import { useTestDatabase } from "./testing/database.ts";

const database = useTestDatabase();

beforeAll(async () => {
  await migrate(database.get());
});

const request = (workspaceId: ObjectId, key: string, body: unknown = { topic: "UPI" }) => ({
  workspaceId,
  key,
  route: "POST /projects",
  body,
});

describe("withIdempotency", () => {
  it("runs once per key and replays the first result", async () => {
    const workspaceId = new ObjectId();
    let runs = 0;
    const created = new ObjectId();
    const create = async () => {
      runs += 1;
      return { status: 201, resourceId: created };
    };
    const first = await withIdempotency(database.get(), request(workspaceId, "k1"), create);
    const second = await withIdempotency(
      database.get(),
      request(workspaceId, "k1", { topic: "UPI" }),
      create,
    );
    expect(runs).toBe(1);
    expect(first).toMatchObject({ status: 201, replayed: false });
    expect(second).toMatchObject({ status: 201, replayed: true });
    expect(second.resourceId.equals(created)).toBe(true);
  });

  it("treats the same body in another key order as the same request", async () => {
    const workspaceId = new ObjectId();
    const create = async () => ({ status: 201, resourceId: new ObjectId() });
    await withIdempotency(
      database.get(),
      request(workspaceId, "k", { a: 1, b: { c: 2, d: 3 } }),
      create,
    );
    const again = await withIdempotency(
      database.get(),
      request(workspaceId, "k", { b: { d: 3, c: 2 }, a: 1 }),
      create,
    );
    expect(again.replayed).toBe(true);
  });

  it("refuses the same key with a different body (IDEMPOTENCY_MISMATCH)", async () => {
    const workspaceId = new ObjectId();
    const create = async () => ({ status: 201, resourceId: new ObjectId() });
    await withIdempotency(database.get(), request(workspaceId, "k2"), create);
    await expect(
      withIdempotency(database.get(), request(workspaceId, "k2", { topic: "Other" }), create),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_MISMATCH" });
  });

  it("keys are per workspace", async () => {
    let runs = 0;
    const create = async () => {
      runs += 1;
      return { status: 201, resourceId: new ObjectId() };
    };
    await withIdempotency(database.get(), request(new ObjectId(), "shared"), create);
    await withIdempotency(database.get(), request(new ObjectId(), "shared"), create);
    expect(runs).toBe(2);
  });

  it("a second request while the first runs is IDEMPOTENCY_IN_PROGRESS", async () => {
    const workspaceId = new ObjectId();
    let release!: () => void;
    const slow = () =>
      new Promise<{ status: number; resourceId: ObjectId }>((resolve) => {
        release = () => resolve({ status: 201, resourceId: new ObjectId() });
      });
    const first = withIdempotency(database.get(), request(workspaceId, "k3"), slow);
    await new Promise((r) => setTimeout(r, 50));
    const second = await withIdempotency(database.get(), request(workspaceId, "k3"), slow).catch(
      (e: unknown) => e,
    );
    expect(second).toBeInstanceOf(IdempotencyError);
    expect((second as IdempotencyError).code).toBe("IDEMPOTENCY_IN_PROGRESS");
    release();
    await expect(first).resolves.toMatchObject({ replayed: false });
  });

  it("a failed request frees the key for a retry", async () => {
    const workspaceId = new ObjectId();
    await expect(
      withIdempotency(database.get(), request(workspaceId, "k4"), async () => {
        throw new Error("moderation down");
      }),
    ).rejects.toThrow("moderation down");
    const retry = await withIdempotency(database.get(), request(workspaceId, "k4"), async () => ({
      status: 201,
      resourceId: new ObjectId(),
    }));
    expect(retry.replayed).toBe(false);
  });
});
