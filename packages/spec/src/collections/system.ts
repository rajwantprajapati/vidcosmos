// notifications, admin_audit, migrations (DB §9).
import { z } from "zod";
import { count, date, objectId, schemaVersion } from "./common.ts";

export const notificationSchema = z.object({
  _id: objectId,
  schemaVersion,
  userId: objectId,
  workspaceId: objectId,
  type: z.enum([
    "video_ready",
    "generation_failed",
    "export_ready",
    "export_failed",
    "post_published",
    "post_failed",
    "post_missed",
    "account_expiring",
    "account_revoked",
    "limit_near",
    "limit_reached",
  ]),
  title: z.string().min(1).max(80),
  body: z.string().max(240),
  /** An app path, e.g. `/projects/{id}`. */
  link: z.string().regex(/^\/(?!\/)/),
  entity: z
    .object({
      kind: z.enum(["project", "export", "post", "social_account"]),
      id: objectId,
    })
    .optional(),
  dedupeKey: z.string().min(1),
  readAt: date.nullable(),
  emailedAt: date.optional(),
  createdAt: date,
});
export type Notification = z.infer<typeof notificationSchema>;

export const adminAuditSchema = z.object({
  _id: objectId,
  schemaVersion,
  actorId: objectId,
  action: z.enum([
    "workspace.block",
    "workspace.unblock",
    "limits.update",
    "job.retry",
    "job.cancel",
    "user.delete",
    "post.cancel",
    "moderation.clear",
  ]),
  target: z.object({
    kind: z.enum(["user", "workspace", "project", "job", "post"]),
    id: objectId,
  }),
  before: z.record(z.string(), z.unknown()).optional(),
  after: z.record(z.string(), z.unknown()).optional(),
  reason: z.string().min(1).max(500),
  ip: z.string(),
  createdAt: date,
});
export type AdminAudit = z.infer<typeof adminAuditSchema>;

/** Migration ids look like `0001-initial-indexes`: four digits, then a kebab-case name. */
export const migrationId = z.string().regex(/^\d{4}-[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const migrationRecordSchema = z.object({
  _id: migrationId,
  name: z.string().min(1),
  /** sha256 of the migration file; a changed file that already ran stops the deploy. */
  checksum: z.string().regex(/^[0-9a-f]{64}$/),
  appliedAt: date,
  durationMs: count,
});

/** Held while migrations run, so two deploys cannot migrate at once. */
export const migrationLockSchema = z.object({
  _id: z.literal("lock"),
  holder: z.string().min(1),
  expiresAt: date,
});

export const migrationSchema = z.union([migrationRecordSchema, migrationLockSchema]);
export type MigrationRecord = z.infer<typeof migrationRecordSchema>;
export type MigrationLock = z.infer<typeof migrationLockSchema>;
export type Migration = z.infer<typeof migrationSchema>;
