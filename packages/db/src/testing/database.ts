// A fresh database per test file on the shared in-memory replica set.
import { randomUUID } from "node:crypto";
import type { Db, MongoClient } from "mongodb";
import { afterAll, beforeAll, inject } from "vitest";
import { createMongoClient } from "../client.ts";

/** Call at the top of a test file. `get()` returns the database inside tests. */
export function useTestDatabase(): { get: () => Db; client: () => MongoClient } {
  let client: MongoClient | undefined;
  let db: Db | undefined;

  beforeAll(async () => {
    client = createMongoClient(inject("mongoUri"));
    await client.connect();
    db = client.db(`test-${randomUUID().slice(0, 8)}`);
  });

  afterAll(async () => {
    await db?.dropDatabase();
    await client?.close();
  });

  return {
    get: () => {
      if (!db) throw new Error("The test database is not ready yet.");
      return db;
    },
    client: () => {
      if (!client) throw new Error("The test client is not ready yet.");
      return client;
    },
  };
}
