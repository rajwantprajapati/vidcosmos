// `pnpm db:migrate`: run migrations against MONGODB_URI (from the root .env, or the
// environment in CI). Prints what it changed; a second run prints that nothing changed.
import { hostname } from "node:os";
import { createMongoClient, databaseNameFromUri } from "./client.ts";
import { migrate, MigrationError } from "./migrate.ts";
import { isEmptyPlan } from "./schema-sync.ts";

const uri = process.env.MONGODB_URI?.trim();
if (!uri || !/^mongodb(\+srv)?:\/\/\S+$/.test(uri)) {
  console.error(
    "MONGODB_URI must be set to a mongodb:// or mongodb+srv:// URL (see .env.example).",
  );
  process.exit(1);
}

const database = databaseNameFromUri(uri);
const client = createMongoClient(uri, { serverSelectionTimeoutMS: 10_000 });
try {
  await client.connect();
  console.log(`Migrating database "${database}"`);
  const result = await migrate(client.db(database), { holder: `${hostname()} pid ${process.pid}` });

  for (const id of result.applied) console.log(`  ran ${id}`);
  const { schema } = result;
  for (const name of schema.create) console.log(`  created collection ${name}`);
  for (const name of schema.updateValidator) console.log(`  updated validator of ${name}`);
  for (const spec of schema.createIndexes) {
    console.log(`  created index ${spec.collection} ${JSON.stringify(spec.keys)}`);
  }
  for (const index of schema.unknownIndexes) {
    console.warn(
      `  warning: ${index.collection}.${index.name} is not in the index catalogue (drop it in a migration)`,
    );
  }
  if (result.applied.length === 0 && isEmptyPlan(schema)) console.log("  nothing to change");
  console.log("Done.");
} catch (error) {
  console.error(error instanceof MigrationError ? error.message : error);
  process.exitCode = 1;
} finally {
  await client.close();
}
