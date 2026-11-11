// The index catalogue (DB §10). Every index exists for a named query; migrations create them,
// never the app at start-up. A test checks that the database has exactly these after migrating.
//
// Better Auth's collections are included too: its MongoDB adapter creates no indexes, and the
// unique ones (email, session token, provider account) are what keep duplicates out.
//
// Not here: the Atlas Search index `projects_search`, which only Atlas can build (added with
// library search).
import type { CollectionName } from "@vidcosmos/spec/collections";
import type { CreateIndexesOptions, IndexDirection } from "mongodb";

export type IndexSpec = {
  /** App collections, or a Better Auth collection that gets an app TTL index. */
  collection: CollectionName | BetterAuthCollection;
  keys: Record<string, IndexDirection>;
  options?: Pick<
    CreateIndexesOptions,
    "unique" | "sparse" | "partialFilterExpression" | "expireAfterSeconds"
  >;
  /** The query this index serves (DB §10). */
  serves: string;
};

/** Collections owned by Better Auth (DB §3). */
export type BetterAuthCollection = "user" | "session" | "account" | "verification" | "rateLimit";

const days = (n: number) => n * 24 * 60 * 60;

export const indexCatalogue: readonly IndexSpec[] = [
  // workspaces
  {
    collection: "workspaces",
    keys: { ownerId: 1 },
    options: { unique: true },
    serves: "One workspace per user",
  },
  {
    collection: "workspaces",
    keys: { "flags.blocked": 1 },
    options: { partialFilterExpression: { "flags.blocked": true } },
    serves: "Admin list of blocked workspaces",
  },

  // projects
  {
    collection: "projects",
    keys: { workspaceId: 1, deletedAt: 1, updatedAt: -1 },
    serves: "Library, newest first",
  },
  {
    collection: "projects",
    keys: { workspaceId: 1, deletedAt: 1, stage: 1, updatedAt: -1 },
    serves: "Library filtered by status",
  },
  {
    collection: "projects",
    keys: { deletedAt: 1 },
    options: { partialFilterExpression: { deletedAt: { $type: "date" } } },
    serves: "Purge job",
  },

  // project_versions
  {
    collection: "project_versions",
    keys: { projectId: 1, number: -1 },
    options: { unique: true },
    serves: "Version history; a retried insert fails harmlessly",
  },

  // chat_messages
  { collection: "chat_messages", keys: { projectId: 1, createdAt: -1 }, serves: "Chat panel" },
  {
    collection: "chat_messages",
    keys: { projectId: 1, status: 1 },
    options: { partialFilterExpression: { status: "proposed" } },
    serves: "Open proposals",
  },

  // jobs
  {
    collection: "jobs",
    keys: { workspaceId: 1, status: 1 },
    options: { partialFilterExpression: { status: { $in: ["queued", "running"] } } },
    serves: "Concurrent job limit",
  },
  {
    collection: "jobs",
    keys: { projectId: 1, createdAt: -1 },
    serves: "Project activity, latest job",
  },
  {
    collection: "jobs",
    keys: { workspaceId: 1, idempotencyKey: 1 },
    options: { unique: true, partialFilterExpression: { idempotencyKey: { $exists: true } } },
    serves: "Idempotent requests",
  },
  {
    collection: "jobs",
    keys: { status: 1, heartbeatAt: 1 },
    options: { partialFilterExpression: { status: "running" } },
    serves: "Stuck-job sweeper",
  },
  {
    collection: "jobs",
    keys: { expiresAt: 1 },
    options: { expireAfterSeconds: 0 },
    serves: "Cleanup 180 days after finishing",
  },

  // assets
  {
    collection: "assets",
    keys: { workspaceId: 1, kind: 1, hash: 1 },
    options: { unique: true },
    serves: "Narration cache",
  },
  { collection: "assets", keys: { lastUsedAt: 1 }, serves: "Asset sweeper" },

  // exports
  {
    collection: "exports",
    keys: { projectId: 1, specHash: 1, resolution: 1 },
    options: { unique: true, partialFilterExpression: { active: true } },
    serves: "Render cache",
  },
  { collection: "exports", keys: { projectId: 1, createdAt: -1 }, serves: "Exports of a video" },
  {
    collection: "exports",
    keys: { status: 1, expiresAt: 1 },
    options: { partialFilterExpression: { status: "ready" } },
    serves: "Export expiry job",
  },

  // social_accounts
  {
    collection: "social_accounts",
    keys: { workspaceId: 1, platform: 1 },
    options: { unique: true, partialFilterExpression: { active: true } },
    serves: "One live connection per workspace",
  },
  {
    collection: "social_accounts",
    keys: { status: 1, tokenExpiresAt: 1 },
    options: { partialFilterExpression: { active: true } },
    serves: "Daily token refresh cron",
  },
  {
    collection: "social_accounts",
    keys: { igUserId: 1 },
    serves: "Same Instagram account on two workspaces",
  },

  // oauth_states
  {
    collection: "oauth_states",
    keys: { stateHash: 1 },
    options: { unique: true },
    serves: "Connect callback",
  },
  {
    collection: "oauth_states",
    keys: { expiresAt: 1 },
    options: { expireAfterSeconds: 0 },
    serves: "Expire after 10 minutes",
  },

  // posts
  {
    collection: "posts",
    keys: { workspaceId: 1, scheduledFor: 1 },
    serves: "Calendar and upcoming posts",
  },
  { collection: "posts", keys: { projectId: 1, createdAt: -1 }, serves: "Posts of a video" },
  {
    collection: "posts",
    keys: { status: 1, scheduledFor: 1 },
    options: {
      partialFilterExpression: { status: { $in: ["scheduled", "uploading", "processing"] } },
    },
    serves: "Reconciliation cron",
  },
  {
    collection: "posts",
    keys: { socialAccountId: 1, status: 1 },
    serves: "Pausing posts of a revoked account",
  },
  { collection: "posts", keys: { exportId: 1 }, serves: "Keeping an export while a post needs it" },

  // usage_events
  {
    collection: "usage_events",
    keys: { workspaceId: 1, createdAt: -1 },
    serves: "Workspace cost history",
  },
  { collection: "usage_events", keys: { provider: 1, createdAt: -1 }, serves: "Admin cost view" },
  {
    collection: "usage_events",
    keys: { jobId: 1 },
    options: { sparse: true },
    serves: "Cost of a job",
  },
  {
    collection: "usage_events",
    keys: { createdAt: 1 },
    options: { expireAfterSeconds: days(400) },
    serves: "Keep 400 days",
  },

  // moderation_events
  {
    collection: "moderation_events",
    keys: { workspaceId: 1, createdAt: -1 },
    serves: "Workspace moderation history",
  },
  {
    collection: "moderation_events",
    keys: { decision: 1, createdAt: -1 },
    serves: "Admin review queue",
  },
  {
    collection: "moderation_events",
    keys: { createdAt: 1 },
    options: { expireAfterSeconds: days(180) },
    serves: "Keep 180 days",
  },

  // notifications
  {
    collection: "notifications",
    keys: { userId: 1, readAt: 1, createdAt: -1 },
    serves: "Unread badge and list",
  },
  {
    collection: "notifications",
    keys: { userId: 1, dedupeKey: 1 },
    options: { unique: true },
    serves: "No duplicate notifications",
  },
  {
    collection: "notifications",
    keys: { createdAt: 1 },
    options: { expireAfterSeconds: days(90) },
    serves: "Keep 90 days",
  },

  // admin_audit
  {
    collection: "admin_audit",
    keys: { "target.id": 1, createdAt: -1 },
    serves: "History of a target",
  },
  { collection: "admin_audit", keys: { actorId: 1, createdAt: -1 }, serves: "Actions by an admin" },
  {
    collection: "admin_audit",
    keys: { createdAt: 1 },
    options: { expireAfterSeconds: days(730) },
    serves: "Keep 2 years",
  },

  // Better Auth collections (DB §3)
  {
    collection: "user",
    keys: { email: 1 },
    options: { unique: true },
    serves: "One account per email",
  },
  {
    collection: "session",
    keys: { token: 1 },
    options: { unique: true },
    serves: "Session lookup",
  },
  { collection: "session", keys: { userId: 1 }, serves: "A user's sessions" },
  {
    collection: "session",
    keys: { expiresAt: 1 },
    options: { expireAfterSeconds: 0 },
    serves: "Expired sessions",
  },
  { collection: "account", keys: { userId: 1 }, serves: "A user's sign-in methods" },
  {
    collection: "account",
    keys: { providerId: 1, accountId: 1 },
    options: { unique: true },
    serves: "One user per Google account",
  },
  { collection: "verification", keys: { identifier: 1 }, serves: "Verification and reset tokens" },
  {
    collection: "verification",
    keys: { expiresAt: 1 },
    options: { expireAfterSeconds: 0 },
    serves: "Expired verification tokens",
  },
  {
    collection: "rateLimit",
    keys: { key: 1 },
    options: { unique: true },
    serves: "Rate-limit windows",
  },
  {
    collection: "rateLimit",
    keys: { expiresAt: 1 },
    options: { expireAfterSeconds: 0 },
    serves: "Old app rate-limit windows",
  },
];
