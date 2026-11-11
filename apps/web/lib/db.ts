// The app's MongoDB connection: one cached client per server instance (DB §14). The driver
// connects on the first operation. Queries go through `workspaceCollection` from
// `@vidcosmos/db`, which holds each one to the session's workspace.
import { createMongoClient, databaseOf, type Db, type MongoClient } from "@vidcosmos/db";
import { env } from "@/env";

// Kept on globalThis so hot reload in development does not open a new pool on every edit.
const cache = globalThis as typeof globalThis & { __vidcosmosMongo?: MongoClient };

export function getMongoClient(): MongoClient {
  cache.__vidcosmosMongo ??= createMongoClient(env.MONGODB_URI);
  return cache.__vidcosmosMongo;
}

/** The app database: the one named in MONGODB_URI, or `vidcosmos`. */
export function getDb(): Db {
  return databaseOf(getMongoClient(), env.MONGODB_URI);
}
