// F12: asset helpers against MongoDB: the narration hash, the cache lookup per workspace, two
// steps recording the same file at once, and lastUsedAt moving only forward.
import type { Asset } from "@vidcosmos/spec/collections";
import { exampleScenes } from "@vidcosmos/spec/video";
import { testSpec } from "@vidcosmos/spec/video/testing";
import { ObjectId } from "mongodb";
import { beforeAll, describe, expect, it } from "vitest";
import {
  findAsset,
  type NarrationInput,
  narrationHash,
  projectNarration,
  recordAsset,
  sha256Hex,
  specAudioIds,
  touchAssets,
} from "./assets.ts";
import { workspaceCollection } from "./scoped.ts";
import { migrate } from "./migrate.ts";
import { useTestDatabase } from "./testing/database.ts";

const database = useTestDatabase();
const db = () => database.get();

beforeAll(async () => {
  await migrate(db());
});

const voice: NarrationInput = {
  narration: "Every UPI payment makes three hops.",
  language: "en",
  voiceId: "tLGhEubY0Pyc5mxjkJSJ",
  model: "eleven_multilingual_v2",
  speed: 1,
};

function asset(workspaceId: ObjectId, hash: string, at = new Date("2026-11-13T06:00:00Z")): Asset {
  return {
    _id: new ObjectId(),
    schemaVersion: 1,
    workspaceId,
    kind: "narration",
    hash,
    r2Key: `ws/${workspaceId.toHexString()}/narration/${hash}.mp3`,
    mime: "audio/mpeg",
    bytes: 48_213,
    durationMs: 2_900,
    meta: { ...voice, text: voice.narration, characters: 35, words: [] },
    createdAt: at,
    lastUsedAt: at,
  };
}

describe("hashes", () => {
  it("hashes bytes and text as SHA-256 hex", () => {
    expect(sha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
    expect(sha256Hex(new TextEncoder().encode("abc"))).toBe(sha256Hex("abc"));
  });

  it("changes the narration hash with the text or the voice, and nothing else", () => {
    const base = narrationHash(voice);
    expect(base).toMatch(/^[0-9a-f]{64}$/);
    expect(narrationHash({ ...voice })).toBe(base);
    for (const change of [
      { narration: "Every UPI payment makes three hops!" },
      { language: "hi" as const },
      { voiceId: "pOk40AXK0gYhreBApvj7" },
      { model: "eleven_v3" },
      { speed: 1.1 },
    ]) {
      expect(narrationHash({ ...voice, ...change })).not.toBe(base);
    }
    // Fields can't run into each other.
    expect(narrationHash({ ...voice, narration: "a", voiceId: "bc" })).not.toBe(
      narrationHash({ ...voice, narration: "ab", voiceId: "c" }),
    );
  });
});

describe("assets", () => {
  it("finds a recorded asset by hash, only in its own workspace", async () => {
    const ws = new ObjectId();
    const hash = narrationHash(voice);
    expect(await findAsset(db(), ws, "narration", hash)).toBeNull();
    const { created } = await recordAsset(db(), asset(ws, hash));
    expect(created).toBe(true);
    expect((await findAsset(db(), ws, "narration", hash))?.r2Key).toContain(hash);
    expect(await findAsset(db(), new ObjectId(), "narration", hash)).toBeNull();
  });

  it("gives the second of two parallel records the first one's asset", async () => {
    const ws = new ObjectId();
    const hash = narrationHash({ ...voice, narration: "Their bank checks the PIN." });
    const [a, b] = await Promise.all([
      recordAsset(db(), asset(ws, hash)),
      recordAsset(db(), asset(ws, hash)),
    ]);
    expect([a.created, b.created].sort()).toEqual([false, true]);
    expect(a.asset._id).toEqual(b.asset._id);
  });

  it("moves lastUsedAt forward only", async () => {
    const ws = new ObjectId();
    const hash = narrationHash({ ...voice, narration: "Yes, sent, done." });
    await recordAsset(db(), asset(ws, hash, new Date("2026-11-10T00:00:00Z")));

    expect(
      await touchAssets(db(), ws, "narration", [hash, hash], new Date("2026-11-13T00:00:00Z")),
    ).toBe(1);
    expect((await findAsset(db(), ws, "narration", hash))?.lastUsedAt).toEqual(
      new Date("2026-11-13T00:00:00Z"),
    );
    await touchAssets(db(), ws, "narration", [hash], new Date("2026-11-11T00:00:00Z"));
    expect((await findAsset(db(), ws, "narration", hash))?.lastUsedAt).toEqual(
      new Date("2026-11-13T00:00:00Z"),
    );
    expect(await touchAssets(db(), ws, "narration", [])).toBe(0);
    expect(await touchAssets(db(), new ObjectId(), "narration", [hash])).toBe(0);
  });
});

/** A valid timed spec whose first scene plays `assetId`. */
function versionSpec(assetId: string) {
  const spec = testSpec([exampleScenes.title, exampleScenes.recap], { timed: true });
  spec.scenes[0]!.timing!.narrationAssetId = assetId;
  return spec;
}

describe("the audio a project plays (F21)", () => {
  const specWith = (ids: (string | null)[]) => ({
    scenes: ids.map((id) => ({ timing: id ? { narrationAssetId: id } : null })),
  });

  it("lists each recording a spec plays, once", () => {
    expect(specAudioIds(specWith(["a1", null, "a1", "b2"]))).toEqual(["a1", "b2"]);
    expect(specAudioIds(null)).toEqual([]);
    expect(specAudioIds({ scenes: "not a list" })).toEqual([]);
  });

  it("gives the draft's recordings, and a version's when asked, never another project's", async () => {
    const workspaceId = new ObjectId();
    const projectId = new ObjectId();
    const [inDraft, inVersion, elsewhere] = await Promise.all(
      ["d", "v", "e"].map(async (c) => {
        const made = asset(workspaceId, c.repeat(64));
        await recordAsset(db(), made);
        return made._id.toHexString();
      }),
    );
    await workspaceCollection(db(), "project_versions").insertOne({
      _id: new ObjectId(),
      schemaVersion: 1,
      workspaceId,
      projectId,
      number: 1,
      spec: versionSpec(inVersion!),
      specHash: "0".repeat(64),
      reason: "generate",
      summary: "First version",
      durationMs: 1000,
      sceneCount: 1,
      createdBy: new ObjectId(),
      createdAt: new Date(),
    });
    const project = { _id: projectId, workspaceId, draft: { spec: specWith([inDraft!]) } };

    const draftOnly = await projectNarration(db(), project);
    expect(draftOnly.map((a) => a.id)).toEqual([inDraft]);
    expect(draftOnly[0]!.key).toMatch(/\/narration\/d{64}\.mp3$/);
    const asked = await projectNarration(db(), project, [inVersion!, elsewhere!, "not-an-id"]);
    expect(asked.map((a) => a.id)).toEqual([inVersion]);
    // The version's other scene plays a recording this workspace doesn't have: left out.
    expect(specAudioIds(versionSpec(inVersion!))).toHaveLength(2);
  });
});
