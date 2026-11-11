// The 15 app collections (DB §1): one zod schema per document type. Better Auth's five
// collections (user, session, account, verification, rateLimit) are owned by Better Auth.
import { assetSchema, exportSchema, jobSchema } from "./job.ts";
import { chatMessageSchema, projectSchema, projectVersionSchema } from "./project.ts";
import { oauthStateSchema, postSchema, socialAccountSchema } from "./publishing.ts";
import { adminAuditSchema, migrationSchema, notificationSchema } from "./system.ts";
import { moderationEventSchema, usageEventSchema, workspaceSchema } from "./workspace.ts";

export * from "./common.ts";
export * from "./job.ts";
export * from "./project.ts";
export * from "./publishing.ts";
export * from "./system.ts";
export * from "./user.ts";
export * from "./workspace.ts";

export const collectionSchemas = {
  workspaces: workspaceSchema,
  usage_events: usageEventSchema,
  moderation_events: moderationEventSchema,
  projects: projectSchema,
  project_versions: projectVersionSchema,
  chat_messages: chatMessageSchema,
  jobs: jobSchema,
  assets: assetSchema,
  exports: exportSchema,
  social_accounts: socialAccountSchema,
  oauth_states: oauthStateSchema,
  posts: postSchema,
  notifications: notificationSchema,
  admin_audit: adminAuditSchema,
  migrations: migrationSchema,
} as const;

export type CollectionName = keyof typeof collectionSchemas;
export const collectionNames = Object.keys(collectionSchemas) as CollectionName[];

/** Collections whose documents carry `workspaceId`. `workspaces` is scoped by its own `_id`. */
export const workspaceScopedCollections = [
  "usage_events",
  "moderation_events",
  "projects",
  "project_versions",
  "chat_messages",
  "jobs",
  "assets",
  "exports",
  "social_accounts",
  "oauth_states",
  "posts",
  "notifications",
] as const satisfies readonly CollectionName[];
