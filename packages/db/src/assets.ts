// Asset helpers (DB §7 "assets"): files the app made and reuses, found by content hash. In V1
// that's narration, so the `{ workspaceId, kind, hash }` unique index is the narration cache:
// before calling the voice service, the pipeline looks the hash up and, on a hit, pays nothing.
import { createHash } from "node:crypto";
import type { Asset } from "@vidcosmos/spec/collections";
import { type Db, ObjectId } from "mongodb";
import { workspaceCollection } from "./scoped.ts";

const assets = (db: Db) => workspaceCollection(db, "assets");

/** SHA-256 of some bytes or text, as 64 hex characters. */
export function sha256Hex(data: Uint8Array | string): string {
  return createHash("sha256").update(data).digest("hex");
}

export type NarrationInput = {
  narration: string;
  language: "en" | "hi";
  voiceId: string;
  model: string;
  speed: number;
};

/**
 * What fixes a scene's audio (DB §6): the narration and the voice. The same inputs always give
 * the same hash, so an unchanged scene keeps its audio; anything else (theme, labels, format)
 * isn't part of it.
 */
export function narrationHash(input: NarrationInput): string {
  return sha256Hex(
    JSON.stringify([input.narration, input.language, input.voiceId, input.model, input.speed]),
  );
}

export function findAsset(
  db: Db,
  workspaceId: ObjectId,
  kind: Asset["kind"],
  hash: string,
): Promise<Asset | null> {
  return assets(db).findOne({ workspaceId, kind, hash });
}

/**
 * Records a new asset. When two steps made the same file at once, the second insert hits the
 * unique index and gets the first one's asset back (`created: false`). Keys are built from the
 * hash, so both uploads went to the same R2 object and nothing needs deleting.
 */
export async function recordAsset(
  db: Db,
  asset: Asset,
): Promise<{ asset: Asset; created: boolean }> {
  try {
    await assets(db).insertOne(asset);
    return { asset, created: true };
  } catch (error) {
    if ((error as { code?: number }).code !== 11000) throw error;
    const existing = await findAsset(db, asset.workspaceId, asset.kind, asset.hash);
    if (!existing) throw error;
    return { asset: existing, created: false };
  }
}

/**
 * Marks assets as used now (a draft or version started using them), so the weekly sweeper
 * keeps them for another 30 days. `lastUsedAt` only moves forward.
 */
export async function touchAssets(
  db: Db,
  workspaceId: ObjectId,
  kind: Asset["kind"],
  hashes: string[],
  now = new Date(),
): Promise<number> {
  if (hashes.length === 0) return 0;
  const result = await assets(db).updateMany(
    { workspaceId, kind, hash: { $in: [...new Set(hashes)] } },
    { $max: { lastUsedAt: now } },
  );
  return result.matchedCount;
}

/** The narration asset ids a stored spec plays (`timing.narrationAssetId`). */
export function specAudioIds(spec: unknown): string[] {
  const scenes = (spec as { scenes?: unknown } | null)?.scenes;
  if (!Array.isArray(scenes)) return [];
  const ids = scenes.flatMap((scene) => {
    const id = (scene as { timing?: { narrationAssetId?: unknown } | null })?.timing
      ?.narrationAssetId;
    return typeof id === "string" ? [id] : [];
  });
  return [...new Set(ids)];
}

/**
 * The narration assets a project may play, by id: those its draft or any of its versions use
 * (API §7 "Audio URLs"). Ids it doesn't use, or that aren't hex, are left out.
 */
export async function projectNarration(
  db: Db,
  project: { _id: ObjectId; workspaceId: ObjectId; draft: { spec: unknown } },
  ids?: string[],
): Promise<{ id: string; key: string }[]> {
  const used = new Set(specAudioIds(project.draft.spec));
  if (ids?.some((id) => !used.has(id))) {
    const versions = await workspaceCollection(db, "project_versions")
      .find(
        { workspaceId: project.workspaceId, projectId: project._id },
        { projection: { "spec.scenes.timing.narrationAssetId": 1 } },
      )
      .toArray();
    for (const version of versions) {
      for (const id of specAudioIds(version.spec as Parameters<typeof specAudioIds>[0]))
        used.add(id);
    }
  }
  const wanted = (ids ?? [...used]).filter((id) => used.has(id) && /^[0-9a-f]{24}$/.test(id));
  if (wanted.length === 0) return [];
  const found = await assets(db)
    .find(
      { workspaceId: project.workspaceId, _id: { $in: wanted.map((id) => new ObjectId(id)) } },
      { projection: { r2Key: 1 } },
    )
    .toArray();
  return found.map((asset) => ({ id: asset._id.toHexString(), key: asset.r2Key }));
}
