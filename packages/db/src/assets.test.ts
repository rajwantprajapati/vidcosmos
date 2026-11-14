// F12: asset helpers against MongoDB: the narration hash, the cache lookup per workspace, two
// steps recording the same file at once, and lastUsedAt moving only forward.
import type { Asset } from "@vidcosmos/spec/collections";
import { ObjectId } from "mongodb";
import { beforeAll, describe, expect, it } from "vitest";
import {
  findAsset,
  type NarrationInput,
  narrationHash,
  recordAsset,
  sha256Hex,
  touchAssets,
} from "./assets.ts";
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
