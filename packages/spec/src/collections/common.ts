// Building blocks shared by the collection schemas (DB §1 conventions).
import type { ObjectId } from "bson";
import { z } from "zod";

export type { ObjectId };

/**
 * True for an ObjectId from any copy of `bson`. `instanceof` is not reliable: the `mongodb`
 * driver loads bson's CommonJS build while ES modules get its ESM build, two different classes.
 * Server code creates ids with `ObjectId` from `@vidcosmos/db` (the driver's class).
 */
export function isObjectId(value: unknown): value is ObjectId {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { _bsontype?: unknown })._bsontype === "ObjectId"
  );
}

/** A MongoDB ObjectId. `bsonType` tells the validator generator in `@vidcosmos/db` which BSON type to require. */
export const objectId = z
  .custom<ObjectId>(isObjectId, { error: "must be an ObjectId" })
  .meta({ bsonType: "objectId" });

/** A UTC instant. Stored as a BSON date. */
export const date = z.date();

/** `schemaVersion` on every app document: lets migrations upgrade old shapes (DB §13). */
export const schemaVersion = z.int().min(1);

/** Integer counters and sizes: never negative. */
export const count = z.int().min(0);

export const videoFormat = z.enum(["9:16", "16:9", "1:1"]);
export const language = z.enum(["en", "hi"]);
export const voiceGender = z.enum(["female", "male"]);
export const tone = z.enum(["friendly", "professional", "energetic", "calm"]);
export const audienceLevel = z.enum(["kids", "beginner", "intermediate", "expert"]);
export const lengthSec = z.union([z.literal(30), z.literal(60), z.literal(90)]);
export const palette = z.enum(["midnight", "paper", "ocean", "sunset"]);
export const captionStyle = z.enum(["highlight", "classic", "none"]);
export const voiceSpeed = z.number().min(0.85).max(1.15);

export type VideoFormat = z.infer<typeof videoFormat>;
export type Language = z.infer<typeof language>;

/** One spoken word with its timing, from ElevenLabs or estimated. */
export const wordTiming = z.object({
  text: z.string(),
  startMs: count,
  endMs: count,
});

/** A stored error: a machine code and a user-facing message. */
export const errorInfo = z.object({
  code: z.string().min(1),
  message: z.string(),
});

/**
 * The VideoSpec as stored in `projects.draft.spec` and `project_versions.spec`.
 *
 * Placeholder until F16 adds the full schema to this package. MongoDB checks only this top
 * level anyway (DB §13): the full rules are semantic and run in the app.
 */
export const storedVideoSpec = z.looseObject({
  version: z.literal(1),
  scenes: z.array(z.looseObject({})),
});

/**
 * A revision operation in a chat proposal (DB §5). Placeholder until chat revisions
 * (F25) define each `op`; MongoDB only needs to know it is an object with an `op`.
 */
export const storedRevisionOperation = z.looseObject({ op: z.string().min(1) });
