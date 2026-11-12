/** @vidcosmos/db — MongoDB client settings, the workspace-scoped collection helper, indexes and migrations. */
export {
  createMongoClient,
  databaseNameFromUri,
  databaseOf,
  defaultDatabaseName,
  mongoClientOptions,
} from "./client.ts";
export { type BetterAuthCollection, type IndexSpec, indexCatalogue } from "./indexes.ts";
export { migrate, type MigrateOptions, type MigrateResult, MigrationError } from "./migrate.ts";
export { isEmptyPlan, planSchemaSync, type SchemaSyncPlan, syncSchema } from "./schema-sync.ts";
export {
  type DocumentOf,
  ScopedCollection,
  type ScopedFilter,
  systemCollection,
  workspaceCollection,
  type WorkspaceScopedName,
  WorkspaceScopeError,
} from "./scoped.ts";
export { toMongoJsonSchema, validatorFor } from "./validators.ts";
export {
  type AppUserFields,
  needsOnboarding,
  readAppUserFields,
  saveOnboarding,
  skipOnboarding,
} from "./users.ts";
export {
  defaultLimits,
  defaultVideoDefaults,
  ensureWorkspace,
  newWorkspace,
  workspaceName,
} from "./workspaces.ts";
export { type Db, type MongoClient, ObjectId } from "mongodb";
