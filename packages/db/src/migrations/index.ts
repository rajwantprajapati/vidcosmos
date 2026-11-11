// Every migration, in order. Add a file `NNNN-kebab-name.ts` exporting `description` and
// `up(db)`, then list it here. There is no `down`: data migrations are fixed forward (DB §13).
//
// New fields, validators and indexes need no file: `pnpm db:migrate` syncs them from the zod
// schemas and the index catalogue after running these. Files are for data backfills and for
// dropping indexes or fields.
import type { Db } from "mongodb";
import * as initialSchema from "./0001-initial-schema.ts";

export type MigrationModule = { description: string; up: (db: Db) => Promise<void> };

export const migrations: readonly { id: string; module: MigrationModule }[] = [
  { id: "0001-initial-schema", module: initialSchema },
];
