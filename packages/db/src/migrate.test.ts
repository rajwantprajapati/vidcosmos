import { collectionNames } from "@vidcosmos/spec/collections";
import type { Db } from "mongodb";
import { describe, expect, it } from "vitest";
import { indexCatalogue } from "./indexes.ts";
import { migrate, MigrationError } from "./migrate.ts";
import { migrations } from "./migrations/index.ts";
import { isEmptyPlan, planSchemaSync } from "./schema-sync.ts";
import { systemCollection } from "./scoped.ts";
import { useTestDatabase } from "./testing/database.ts";

const database = useTestDatabase();

/** Everything a migration can change: collections with their options, and every index. */
async function snapshot(db: Db) {
  const collections = await db.listCollections().toArray();
  const result: Record<string, unknown> = {};
  for (const info of collections.sort((a, b) => a.name.localeCompare(b.name))) {
    if (info.name === "migrations") continue; // holds the run records themselves
    result[info.name] = {
      options: "options" in info ? info.options : undefined,
      indexes: await db.collection(info.name).listIndexes().toArray(),
    };
  }
  return result;
}

describe("pnpm db:migrate", () => {
  it("creates every collection, validator and catalogue index on an empty database", async () => {
    const db = database.get();
    const result = await migrate(db);
    expect(result.applied).toEqual(migrations.map((m) => m.id));

    const names = (await db.listCollections().toArray()).map((c) => c.name);
    expect(names).toEqual(
      expect.arrayContaining([...collectionNames, "session", "verification", "rateLimit"]),
    );

    const plan = await planSchemaSync(db);
    expect(isEmptyPlan(plan)).toBe(true);
    expect(plan.unknownIndexes).toEqual([]);

    for (const spec of indexCatalogue) {
      const indexes = await db.collection(spec.collection).listIndexes().toArray();
      const index = indexes.find(
        (i) => JSON.stringify(Object.entries(i.key)) === JSON.stringify(Object.entries(spec.keys)),
      );
      expect(index, `${spec.collection} ${JSON.stringify(spec.keys)}`).toBeDefined();
      expect(index).toMatchObject(spec.options ?? {});
    }
  });

  it("records each run with its checksum", async () => {
    const records = await database.get().collection("migrations").find().toArray();
    expect(records).toEqual([
      expect.objectContaining({
        _id: "0001-initial-schema",
        name: expect.any(String),
        checksum: expect.stringMatching(/^[0-9a-f]{64}$/),
        appliedAt: expect.any(Date),
        durationMs: expect.any(Number),
      }),
    ]);
  });

  it("is idempotent: a second run changes nothing", async () => {
    const db = database.get();
    const before = await snapshot(db);
    const records = await db.collection("migrations").find().toArray();

    const result = await migrate(db);

    expect(result.applied).toEqual([]);
    expect(isEmptyPlan(result.schema)).toBe(true);
    expect(await snapshot(db)).toEqual(before);
    expect(await db.collection("migrations").find().toArray()).toEqual(records);
  });

  it("restores a catalogue index that is missing", async () => {
    const db = database.get();
    await db.collection("posts").dropIndex("exportId_1");
    const result = await migrate(db);
    expect(result.schema.createIndexes.map((s) => [s.collection, s.keys])).toEqual([
      ["posts", { exportId: 1 }],
    ]);
    expect(isEmptyPlan(await planSchemaSync(db))).toBe(true);
  });

  it("reports an index that is not in the catalogue without dropping it", async () => {
    const db = database.get();
    await db.collection("projects").createIndex({ title: 1 });
    const result = await migrate(db);
    expect(result.schema.unknownIndexes).toEqual([{ collection: "projects", name: "title_1" }]);
    await db.collection("projects").dropIndex("title_1");
  });

  it("stops when a migration that already ran has changed", async () => {
    const run = migrate(database.get(), { checksumOf: async () => "0".repeat(64) });
    await expect(run).rejects.toThrow(/0001-initial-schema changed after it ran/);
  });

  it("refuses to run while another run holds the lock, and releases its own", async () => {
    const db = database.get();
    const lockExpiry = new Date(Date.now() + 5 * 60 * 1000);
    await systemCollection(db, "migrations").insertOne({
      _id: "lock",
      holder: "deploy 42",
      expiresAt: lockExpiry,
    });

    await expect(migrate(db)).rejects.toThrow(MigrationError);
    await expect(migrate(db)).rejects.toThrow(/deploy 42/);
    expect(await db.collection("migrations").findOne({ _id: "lock" as never })).toMatchObject({
      holder: "deploy 42",
    });

    // Ten minutes later the lock has expired (a crashed run) and is taken over.
    const later = () => new Date(Date.now() + 11 * 60 * 1000);
    await expect(migrate(db, { now: later })).resolves.toMatchObject({ applied: [] });
    expect(await db.collection("migrations").findOne({ _id: "lock" as never })).toBeNull();
  });

  it("runs new migrations in order after the ones already recorded", async () => {
    const db = database.get();
    const ran: string[] = [];
    const extra = ["0002-backfill-a", "0003-backfill-b"].map((id) => ({
      id,
      module: { description: id, up: async () => void ran.push(id) },
    }));
    const result = await migrate(db, {
      migrations: [...migrations, ...extra],
      checksumOf: async (id) =>
        id.startsWith("0001")
          ? (await db.collection("migrations").findOne({ _id: id as never }))?.checksum
          : "a".repeat(64),
    });
    expect(result.applied).toEqual(["0002-backfill-a", "0003-backfill-b"]);
    expect(ran).toEqual(["0002-backfill-a", "0003-backfill-b"]);
  });
});
