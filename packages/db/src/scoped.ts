// The typed collection helper (DB §1, §13 "Tenant isolation").
//
// Every app query names the workspace it runs in. `workspaceCollection(db, 'projects')`
// returns a collection whose filters must contain `workspaceId` as a concrete ObjectId (for
// `workspaces`, its own `_id`). TypeScript requires it, and the helper checks it again at run
// time and throws `WorkspaceScopeError` otherwise, so an operator such as `{ $exists: true }`,
// an `undefined` from a missing session, or an `any` cast cannot widen a query. Updates may
// not change the workspace, and inserts are parsed with the collection's zod schema.
//
// `systemCollection` is the deliberate way out, for crons, sweepers, admin and migrations,
// which work across workspaces. Request handlers use `workspaceCollection`.
import {
  collectionSchemas,
  type CollectionName,
  isObjectId,
  type ObjectId,
  workspaceScopedCollections,
} from "@vidcosmos/spec/collections";
import type {
  AggregateOptions,
  Collection,
  CountDocumentsOptions,
  Db,
  DeleteOptions,
  Document,
  Filter,
  FindOneAndUpdateOptions,
  FindOptions,
  InsertOneOptions,
  OptionalUnlessRequiredId,
  UpdateFilter,
  UpdateOptions,
} from "mongodb";
import type { z } from "zod";

export type DocumentOf<N extends CollectionName> = z.output<(typeof collectionSchemas)[N]>;
export type WorkspaceScopedName = (typeof workspaceScopedCollections)[number] | "workspaces";
export type ScopeKey<N extends WorkspaceScopedName> = N extends "workspaces"
  ? "_id"
  : "workspaceId";

/** A filter that names its workspace. */
export type ScopedFilter<T, K extends string> = Filter<T> & { [P in K]: ObjectId };

type Update<T> = UpdateFilter<T> | Document[];

export class WorkspaceScopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkspaceScopeError";
  }
}

const isScopeField = (key: string, scopeKey: string) =>
  key === scopeKey || key.startsWith(`${scopeKey}.`);

export class ScopedCollection<T extends Document, K extends "_id" | "workspaceId"> {
  readonly name: string;
  readonly #collection: Collection<T>;
  readonly #schema: z.ZodType<T>;
  readonly #scopeKey: K;

  constructor(name: string, collection: Collection<T>, schema: z.ZodType<T>, scopeKey: K) {
    this.name = name;
    this.#collection = collection;
    this.#schema = schema;
    this.#scopeKey = scopeKey;
  }

  #checkFilter(filter: unknown): Filter<T> {
    const value =
      filter && typeof filter === "object"
        ? (filter as Record<string, unknown>)[this.#scopeKey]
        : undefined;
    if (!isObjectId(value)) {
      throw new WorkspaceScopeError(
        `Query on ${this.name} refused: the filter must include ${this.#scopeKey} as an ObjectId.`,
      );
    }
    return filter as Filter<T>;
  }

  #checkUpdate(update: Update<T>): Update<T> {
    const stages: Document[] = Array.isArray(update) ? update : [update];
    for (const stage of stages) {
      for (const [operator, fields] of Object.entries(stage)) {
        const keys = Array.isArray(fields)
          ? fields.map(String) // $unset: ['a', 'b'] in a pipeline
          : typeof fields === "string"
            ? [fields]
            : Object.keys((fields ?? {}) as object);
        if (keys.some((key) => isScopeField(key, this.#scopeKey))) {
          throw new WorkspaceScopeError(
            `Update on ${this.name} refused: ${operator} may not change ${this.#scopeKey}.`,
          );
        }
      }
    }
    return update;
  }

  findOne(filter: ScopedFilter<T, K>, options?: FindOptions) {
    return this.#collection.findOne(this.#checkFilter(filter), options);
  }

  find(filter: ScopedFilter<T, K>, options?: FindOptions) {
    return this.#collection.find(this.#checkFilter(filter), options);
  }

  countDocuments(filter: ScopedFilter<T, K>, options?: CountDocumentsOptions) {
    return this.#collection.countDocuments(this.#checkFilter(filter), options);
  }

  /** Parses the document with the collection's zod schema before writing it. */
  insertOne(document: T, options?: InsertOneOptions) {
    const parsed = this.#schema.parse(document);
    this.#checkFilter(parsed);
    return this.#collection.insertOne(parsed as OptionalUnlessRequiredId<T>, options);
  }

  updateOne(filter: ScopedFilter<T, K>, update: Update<T>, options?: UpdateOptions) {
    return this.#collection.updateOne(
      this.#checkFilter(filter),
      this.#checkUpdate(update),
      options,
    );
  }

  updateMany(filter: ScopedFilter<T, K>, update: Update<T>, options?: UpdateOptions) {
    return this.#collection.updateMany(
      this.#checkFilter(filter),
      this.#checkUpdate(update),
      options,
    );
  }

  findOneAndUpdate(
    filter: ScopedFilter<T, K>,
    update: Update<T>,
    options: FindOneAndUpdateOptions = {},
  ) {
    return this.#collection.findOneAndUpdate(
      this.#checkFilter(filter),
      this.#checkUpdate(update),
      options,
    );
  }

  deleteOne(filter: ScopedFilter<T, K>, options?: DeleteOptions) {
    return this.#collection.deleteOne(this.#checkFilter(filter), options);
  }

  deleteMany(filter: ScopedFilter<T, K>, options?: DeleteOptions) {
    return this.#collection.deleteMany(this.#checkFilter(filter), options);
  }

  /** The first stage must be a `$match` that names the workspace. */
  aggregate<R extends Document = Document>(
    pipeline: [{ $match: ScopedFilter<T, K> }, ...Document[]],
    options?: AggregateOptions,
  ) {
    const [first] = pipeline as Document[];
    this.#checkFilter(first?.$match);
    return this.#collection.aggregate<R>(pipeline, options);
  }
}

const scopedNames = new Set<string>([...workspaceScopedCollections, "workspaces"]);

/** A collection whose every query and write is held to one workspace. */
export function workspaceCollection<N extends WorkspaceScopedName>(
  db: Db,
  name: N,
): ScopedCollection<DocumentOf<N>, ScopeKey<N>> {
  if (!scopedNames.has(name)) {
    throw new WorkspaceScopeError(`${name} is not a workspace-scoped collection.`);
  }
  const scopeKey = (name === "workspaces" ? "_id" : "workspaceId") as ScopeKey<N>;
  return new ScopedCollection(
    name,
    db.collection<DocumentOf<N>>(name),
    collectionSchemas[name] as unknown as z.ZodType<DocumentOf<N>>,
    scopeKey,
  );
}

/**
 * The raw collection, across all workspaces. Only for crons, sweepers, admin tools and
 * migrations; request handlers use `workspaceCollection`.
 */
export function systemCollection<N extends CollectionName>(
  db: Db,
  name: N,
): Collection<DocumentOf<N>> {
  return db.collection<DocumentOf<N>>(name);
}
