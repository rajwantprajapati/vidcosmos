// social_accounts, oauth_states, posts (DB §8).
import { z } from "zod";
import { count, date, errorInfo, objectId, schemaVersion } from "./common.ts";

export const socialAccountSchema = z.object({
  _id: objectId,
  schemaVersion,
  workspaceId: objectId,
  connectedBy: objectId,
  platform: z.literal("instagram"),
  igUserId: z.string().min(1),
  username: z.string().min(1),
  accountType: z.enum(["BUSINESS", "MEDIA_CREATOR"]),
  profilePictureUrl: z.string().optional(),
  /**
   * The long-lived access token, encrypted with AES-256-GCM (DB §13). Removed on disconnect,
   * so the row can stay for past posts without a usable token.
   */
  token: z
    .object({
      ciphertext: z.string().min(1),
      iv: z.string().min(1),
      tag: z.string().min(1),
      keyVersion: z.int().min(1),
    })
    .optional(),
  tokenExpiresAt: date,
  tokenRefreshedAt: date,
  scopes: z.array(z.string()),
  status: z.enum(["connected", "expiring", "revoked", "disconnected"]),
  active: z.boolean(),
  lastError: errorInfo.extend({ at: date }).optional(),
  publishQuota: z.object({ used: count, checkedAt: date }).optional(),
  connectedAt: date,
  disconnectedAt: date.optional(),
  createdAt: date,
  updatedAt: date,
});
export type SocialAccount = z.infer<typeof socialAccountSchema>;

export const oauthStateSchema = z.object({
  _id: objectId,
  schemaVersion,
  /** sha256 of the random state sent to Instagram; the state itself is never stored. */
  stateHash: z.string().regex(/^[0-9a-f]{64}$/),
  userId: objectId,
  workspaceId: objectId,
  platform: z.literal("instagram"),
  /** An app path only, never a full URL. */
  returnTo: z.string().regex(/^\/(?!\/)/),
  createdAt: date,
  expiresAt: date,
});
export type OAuthState = z.infer<typeof oauthStateSchema>;

export const postStatus = z.enum([
  "scheduled",
  "uploading",
  "processing",
  "published",
  "failed",
  "missed",
  "needs_reconnect",
  "cancelled",
]);

export const postSchema = z.object({
  _id: objectId,
  schemaVersion,
  workspaceId: objectId,
  projectId: objectId,
  exportId: objectId,
  socialAccountId: objectId,
  createdBy: objectId,
  /** Instagram allows 2,200 characters and 30 hashtags; the API checks the hashtags. */
  caption: z.string().max(2200),
  coverAtMs: count.optional(),
  shareToFeed: z.boolean(),
  /** Null means "post now". */
  scheduledFor: date.nullable(),
  timeZone: z.string().min(1),
  status: postStatus,
  attempts: count,
  inngestEventId: z.string().min(1),
  ig: z.object({
    containerId: z.string().optional(),
    // Instagram's own spelling (DB §1).
    containerStatus: z
      .enum(["IN_PROGRESS", "FINISHED", "ERROR", "EXPIRED", "PUBLISHED"])
      .optional(),
    mediaId: z.string().optional(),
    permalink: z.string().optional(),
  }),
  error: errorInfo.extend({ igCode: z.int().optional(), igSubcode: z.int().optional() }).optional(),
  publishedAt: date.optional(),
  cancelledAt: date.optional(),
  createdAt: date,
  updatedAt: date,
});
export type Post = z.infer<typeof postSchema>;
