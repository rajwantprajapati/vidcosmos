// The MongoDB client settings (DB §14 "Connections from serverless", DB §11).
import { type Db, MongoClient, type MongoClientOptions } from "mongodb";

/** The database used when the connection string names none (Atlas strings usually don't). */
export const defaultDatabaseName = "vidcosmos";

export const mongoClientOptions = {
  // Each function instance keeps at most 5 connections and gives idle ones back after 60 s.
  maxPoolSize: 5,
  minPoolSize: 0,
  maxIdleTimeMS: 60_000,
  // Every write waits for a majority; reads go to the primary so the editor sees its own save.
  writeConcern: { w: "majority" },
  readPreference: "primary",
  appName: "vidcosmos",
} as const satisfies MongoClientOptions;

/**
 * The database named in the connection string's path, e.g. `vidcosmos` in
 * `mongodb://localhost:27017/vidcosmos?directConnection=true`, else `vidcosmos`.
 */
export function databaseNameFromUri(uri: string): string {
  const match = /^mongodb(?:\+srv)?:\/\/[^/?]+\/([^?]*)/.exec(uri);
  const name = match?.[1] ? decodeURIComponent(match[1]) : "";
  return name || defaultDatabaseName;
}

export function createMongoClient(uri: string, options: MongoClientOptions = {}): MongoClient {
  return new MongoClient(uri, { ...mongoClientOptions, ...options });
}

/** The app database of a client created from `uri`. */
export function databaseOf(client: MongoClient, uri: string): Db {
  return client.db(databaseNameFromUri(uri));
}
