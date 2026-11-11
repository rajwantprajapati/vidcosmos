// The first schema: the 15 app collections with their validators, and every index in the
// catalogue, including the TTL indexes on Better Auth's session, verification and rateLimit.
import type { Db } from "mongodb";
import { syncSchema } from "../schema-sync.ts";

export const description = "Collections, validators and indexes from DB §10";

export async function up(db: Db): Promise<void> {
  await syncSchema(db);
}
