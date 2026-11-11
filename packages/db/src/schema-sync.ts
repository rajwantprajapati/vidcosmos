// Brings the database in line with the code: every app collection exists with the validator
// generated from its zod schema, and every index in the catalogue exists. `pnpm db:migrate`
// runs this after the migration files, so a schema or catalogue change ships with no extra
// file. It only adds and updates: dropping an index is its own migration (DB §13).
//
// Running it twice changes nothing: the second run finds nothing to do.
import { collectionNames, type CollectionName } from "@vidcosmos/spec/collections";
import type { Db, IndexDescriptionInfo } from "mongodb";
import { type IndexSpec, indexCatalogue } from "./indexes.ts";
import { validationOptions, validatorFor } from "./validators.ts";

export type SchemaSyncPlan = {
  /** Collections to create, with their validator. */
  create: CollectionName[];
  /** Existing collections whose validator or validation options differ. */
  updateValidator: CollectionName[];
  /** Catalogue indexes missing from the database. */
  createIndexes: IndexSpec[];
  /** Indexes in the database that are not in the catalogue (reported, never dropped here). */
  unknownIndexes: { collection: string; name: string }[];
};

/** JSON with sorted object keys, for comparing documents regardless of key order. */
function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)))
      : v,
  );
}

/** Index keys are ordered, so they are compared in order. */
const keyOf = (keys: Record<string, unknown>) => JSON.stringify(Object.entries(keys));

function optionsOf(index: {
  unique?: boolean;
  sparse?: boolean;
  partialFilterExpression?: unknown;
  expireAfterSeconds?: number;
}) {
  return canonical({
    unique: index.unique ?? false,
    sparse: index.sparse ?? false,
    partialFilterExpression: index.partialFilterExpression ?? null,
    expireAfterSeconds: index.expireAfterSeconds ?? null,
  });
}

async function existingCollections(db: Db) {
  const infos = await db.listCollections({}, { nameOnly: false }).toArray();
  return new Map(
    infos.map((info) => [info.name, "options" in info ? (info.options ?? {}) : {}] as const),
  );
}

async function existingIndexes(db: Db, collection: string): Promise<IndexDescriptionInfo[]> {
  try {
    return await db.collection(collection).listIndexes().toArray();
  } catch (error) {
    // NamespaceNotFound: the collection does not exist yet, so it has no indexes.
    if ((error as { code?: number }).code === 26) return [];
    throw error;
  }
}

export async function planSchemaSync(db: Db): Promise<SchemaSyncPlan> {
  const plan: SchemaSyncPlan = {
    create: [],
    updateValidator: [],
    createIndexes: [],
    unknownIndexes: [],
  };

  const collections = await existingCollections(db);
  for (const name of collectionNames) {
    const options = collections.get(name);
    if (!options) {
      plan.create.push(name);
      continue;
    }
    const current = canonical({
      validator: options.validator,
      validationLevel: options.validationLevel,
      validationAction: options.validationAction,
    });
    if (current !== canonical({ validator: validatorFor(name), ...validationOptions })) {
      plan.updateValidator.push(name);
    }
  }

  const byCollection = new Map<string, IndexSpec[]>();
  for (const spec of indexCatalogue) {
    byCollection.set(spec.collection, [...(byCollection.get(spec.collection) ?? []), spec]);
  }
  for (const [collection, specs] of byCollection) {
    const indexes = await existingIndexes(db, collection);
    for (const spec of specs) {
      const sameKeys = indexes.find((index) => keyOf(index.key) === keyOf(spec.keys));
      if (!sameKeys) {
        plan.createIndexes.push(spec);
      } else if (optionsOf(sameKeys) !== optionsOf(spec.options ?? {})) {
        throw new Error(
          `${collection}.${sameKeys.name} exists with different options from the catalogue. ` +
            "Drop it in a migration first, then the new definition is created.",
        );
      }
    }
  }

  // Unknown indexes are only checked on app collections: Better Auth owns its others.
  for (const name of collectionNames) {
    const specs = byCollection.get(name) ?? [];
    for (const index of await existingIndexes(db, name)) {
      if (index.name === "_id_") continue;
      if (!specs.some((spec) => keyOf(spec.keys) === keyOf(index.key))) {
        plan.unknownIndexes.push({ collection: name, name: String(index.name) });
      }
    }
  }

  return plan;
}

/** Apply the plan from `planSchemaSync`. Returns the plan so the caller can report it. */
export async function syncSchema(db: Db): Promise<SchemaSyncPlan> {
  const plan = await planSchemaSync(db);
  for (const name of plan.create) {
    await db.createCollection(name, { validator: validatorFor(name), ...validationOptions });
  }
  for (const name of plan.updateValidator) {
    await db.command({ collMod: name, validator: validatorFor(name), ...validationOptions });
  }
  for (const spec of plan.createIndexes) {
    await db.collection(spec.collection).createIndex(spec.keys, spec.options ?? {});
  }
  return plan;
}

export const isEmptyPlan = (plan: SchemaSyncPlan) =>
  plan.create.length + plan.updateValidator.length + plan.createIndexes.length === 0;
