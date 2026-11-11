// The migration runner behind `pnpm db:migrate` (DB §13).
//
// 1. Take the lock: `{ _id: 'lock' }` in `migrations`, valid for 10 minutes, so two deploys
//    cannot migrate at once. An expired lock (a crashed run) is taken over.
// 2. Refuse to run if a migration that already ran has changed since (checksum mismatch).
// 3. Run each migration file that has not run, in order, recording it with its checksum.
// 4. Sync validators and catalogue indexes from the code (`syncSchema`).
// 5. Release the lock.
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  migrationRecordSchema,
  type MigrationLock,
  type MigrationRecord,
} from "@vidcosmos/spec/collections";
import type { Collection, Db } from "mongodb";
import { type MigrationModule, migrations as allMigrations } from "./migrations/index.ts";
import { type SchemaSyncPlan, syncSchema } from "./schema-sync.ts";

const lockTtlMs = 10 * 60 * 1000;

export type MigrateOptions = {
  /** Who holds the lock, for the error another run sees. */
  holder?: string;
  /** Defaults to every migration in `migrations/index.ts`. */
  migrations?: readonly { id: string; module: MigrationModule }[];
  /** Defaults to the sha256 of `migrations/<id>.ts`. */
  checksumOf?: (id: string) => Promise<string>;
  now?: () => Date;
};

export type MigrateResult = {
  /** Ids of the migration files run this time. */
  applied: string[];
  /** What the schema sync changed. */
  schema: SchemaSyncPlan;
};

export class MigrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MigrationError";
  }
}

async function fileChecksum(id: string): Promise<string> {
  const source = await readFile(new URL(`./migrations/${id}.ts`, import.meta.url));
  return createHash("sha256").update(source).digest("hex");
}

type MigrationsCollection = Collection<MigrationRecord | MigrationLock>;

async function acquireLock(collection: MigrationsCollection, holder: string, now: Date) {
  const expiresAt = new Date(now.getTime() + lockTtlMs);
  try {
    await collection.insertOne({ _id: "lock", holder, expiresAt });
    return;
  } catch (error) {
    if ((error as { code?: number }).code !== 11000) throw error;
  }
  // The lock exists. Take it over only if it has expired.
  const taken = await collection.findOneAndUpdate(
    { _id: "lock", expiresAt: { $lt: now } },
    { $set: { holder, expiresAt } },
  );
  if (!taken) {
    const lock = (await collection.findOne({ _id: "lock" })) as MigrationLock | null;
    throw new MigrationError(
      `Another migration run (${lock?.holder ?? "unknown"}) holds the lock until ` +
        `${lock?.expiresAt.toISOString() ?? "it finishes"}. Try again later.`,
    );
  }
}

export async function migrate(db: Db, options: MigrateOptions = {}): Promise<MigrateResult> {
  const holder = options.holder ?? `pid ${process.pid}`;
  const list = options.migrations ?? allMigrations;
  const checksumOf = options.checksumOf ?? fileChecksum;
  const now = options.now ?? (() => new Date());

  const collection: MigrationsCollection = db.collection("migrations");
  await acquireLock(collection, holder, now());
  try {
    const records = (await collection
      .find({ _id: { $ne: "lock" } })
      .toArray()) as MigrationRecord[];
    const recorded = new Map(records.map((record) => [record._id, record]));

    const pending: { id: string; module: MigrationModule; checksum: string }[] = [];
    for (const { id, module } of list) {
      const checksum = await checksumOf(id);
      const record = recorded.get(id);
      if (!record) pending.push({ id, module, checksum });
      else if (record.checksum !== checksum) {
        throw new MigrationError(
          `Migration ${id} changed after it ran. Migrations are fixed forward: ` +
            "restore the file and add a new migration instead.",
        );
      }
    }

    const applied: string[] = [];
    for (const { id, module, checksum } of pending) {
      const started = Date.now();
      await module.up(db);
      const record = migrationRecordSchema.parse({
        _id: id,
        name: module.description,
        checksum,
        appliedAt: now(),
        durationMs: Date.now() - started,
      });
      await collection.insertOne(record);
      applied.push(id);
    }

    const schema = await syncSchema(db);
    return { applied, schema };
  } finally {
    await collection.deleteOne({ _id: "lock", holder });
  }
}
