// F12: the storage stub. Files round-trip on disk, signed URLs work like R2's (wrong method,
// tampering, expiry and a wrong upload type are refused with 403), Range requests seek, and
// prefix deletes remove a whole folder.
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { exportKey, exportPrefix, narrationKey } from "./keys.ts";
import {
  createLocalArtifactStore,
  handleLocalStorageRequest,
  type LocalArtifactStore,
  localMaxUploadBytes,
} from "./local.ts";

const ws = "6730a1b2c3d4e5f6a7b8c9d0";
const exportId = "6730a1b2c3d4e5f6a7b8c9d1";
const key = narrationKey(ws, "b".repeat(64));
const routeUrl = "http://localhost:3000/api/dev/storage";
const secret = "s".repeat(32);

let root: string;
let clock = new Date("2026-11-13T06:00:00Z");
let store: LocalArtifactStore;

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "vidcosmos-storage-"));
  store = createLocalArtifactStore({ root, routeUrl, secret, now: () => clock });
});

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

const bytes = (text: string) => new TextEncoder().encode(text);

/** Runs a signed URL through the route logic, as the app's route would. */
function call(url: string, init: RequestInit = {}) {
  const parsed = new URL(url);
  const path = decodeURIComponent(parsed.pathname.slice(new URL(routeUrl).pathname.length + 1));
  return handleLocalStorageRequest(store, new Request(url, init), path);
}

describe("local store", () => {
  it("puts, heads, gets and deletes", async () => {
    await store.put(key, bytes("narration"), { contentType: "audio/mpeg" });
    expect(await store.head(key)).toEqual({ contentType: "audio/mpeg", bytes: 9 });
    const got = await store.get(key);
    expect(new TextDecoder().decode(got!.body)).toBe("narration");
    expect(got?.contentType).toBe("audio/mpeg");
    await store.delete(key);
    expect(await store.get(key)).toBeNull();
    expect(await store.head(key)).toBeNull();
    await store.delete(key); // deleting again is fine
  });

  it("refuses keys outside the layout", async () => {
    await expect(
      store.put("../escape.txt", bytes("x"), { contentType: "text/plain" }),
    ).rejects.toThrow();
    await expect(store.signGet(`ws/${ws}/../x`, { expiresIn: 60 })).rejects.toThrow();
  });

  it("deletes a whole prefix", async () => {
    await store.put(exportKey(ws, exportId, "mp4"), bytes("v"), { contentType: "video/mp4" });
    await store.put(exportKey(ws, exportId, "cover"), bytes("c"), { contentType: "image/jpeg" });
    expect(await store.deletePrefix(exportPrefix(ws, exportId))).toBe(2);
    expect(await store.get(exportKey(ws, exportId, "mp4"))).toBeNull();
    expect(await store.deletePrefix(exportPrefix(ws, exportId))).toBe(0);
  });
});

describe("signed URLs", () => {
  beforeAll(async () => {
    await store.put(key, bytes("0123456789"), { contentType: "audio/mpeg" });
  });

  it("serves a signed GET, with Range for seeking", async () => {
    const { url, expiresAt } = await store.signGet(key, { expiresIn: 3600 });
    expect(url.startsWith(`${routeUrl}/ws/${ws}/narration/`)).toBe(true);
    expect(expiresAt).toEqual(new Date(clock.getTime() + 3600_000));

    const whole = await call(url);
    expect(whole.status).toBe(200);
    expect(whole.headers.get("content-type")).toBe("audio/mpeg");
    expect(whole.headers.get("accept-ranges")).toBe("bytes");
    expect(await whole.text()).toBe("0123456789");

    const part = await call(url, { headers: { Range: "bytes=2-5" } });
    expect(part.status).toBe(206);
    expect(part.headers.get("content-range")).toBe("bytes 2-5/10");
    expect(await part.text()).toBe("2345");
    expect(await (await call(url, { headers: { Range: "bytes=7-" } })).text()).toBe("789");
    expect(await (await call(url, { headers: { Range: "bytes=-3" } })).text()).toBe("789");
    expect((await call(url, { headers: { Range: "bytes=20-" } })).status).toBe(416);

    const head = await call(url, { method: "HEAD" });
    expect(head.status).toBe(200);
    expect(head.headers.get("content-length")).toBe("10");
  });

  it("sets the download name when asked", async () => {
    const { url } = await store.signGet(key, { expiresIn: 900, downloadAs: "How UPI works.mp3" });
    const response = await call(url);
    expect(response.headers.get("content-disposition")).toContain('filename="How UPI works.mp3"');
    // The name is signed: changing it breaks the link.
    expect((await call(url.replace("How", "Who"))).status).toBe(403);
  });

  it("refuses tampered, expired and wrong-method links", async () => {
    const { url } = await store.signGet(key, { expiresIn: 60 });
    const otherKey = narrationKey(ws, "c".repeat(64));
    await store.put(otherKey, bytes("other"), { contentType: "audio/mpeg" });
    expect((await call(url.replace("b".repeat(64), "c".repeat(64)))).status).toBe(403);
    expect((await call(url.replace(/sig=[^&]+/, "sig=AAAA"))).status).toBe(403);
    expect((await call(url.replace(/expires=\d+/, "expires=9999999999"))).status).toBe(403);
    expect(
      (await call(url, { method: "PUT", body: "x", headers: { "Content-Type": "audio/mpeg" } }))
        .status,
    ).toBe(403);

    clock = new Date(clock.getTime() + 61_000);
    expect((await call(url)).status).toBe(403);
  });

  it("accepts a signed PUT with the signed Content-Type only", async () => {
    const target = exportKey(ws, exportId, "mp4");
    const { url } = await store.signPut(target, { expiresIn: 1800, contentType: "video/mp4" });
    const wrongType = await call(url, {
      method: "PUT",
      body: "v",
      headers: { "Content-Type": "text/plain" },
    });
    expect(wrongType.status).toBe(403);
    const ok = await call(url, {
      method: "PUT",
      body: "video",
      headers: { "Content-Type": "video/mp4" },
    });
    expect(ok.status).toBe(200);
    expect(await store.head(target)).toEqual({ contentType: "video/mp4", bytes: 5 });
    // A PUT link doesn't read.
    expect((await call(url)).status).toBe(403);
  });

  it("marks every response nosniff and sandboxed", async () => {
    const { url } = await store.signGet(key, { expiresIn: 60 });
    for (const response of [
      await call(url),
      await call(url, { headers: { Range: "bytes=0-1" } }),
      await call(url, { headers: { Range: "bytes=99-" } }),
      await call(url.replace(/sig=[^&]+/, "sig=AAAA")),
      await call(url, { method: "DELETE" }),
    ]) {
      expect(response.headers.get("x-content-type-options")).toBe("nosniff");
      expect(response.headers.get("content-security-policy")).toBe("sandbox");
    }
  });

  it("refuses an upload over the limit before reading it", async () => {
    const target = exportKey(ws, exportId, "mp3");
    const { url } = await store.signPut(target, { expiresIn: 1800, contentType: "audio/mpeg" });
    const tooBig = await call(url, {
      method: "PUT",
      body: "small",
      headers: { "Content-Type": "audio/mpeg", "Content-Length": String(localMaxUploadBytes + 1) },
    });
    expect(tooBig.status).toBe(413);
    expect(await store.head(target)).toBeNull();
  });

  it("answers 404 for a signed link to a missing file", async () => {
    const { url } = await store.signGet(narrationKey(ws, "d".repeat(64)), { expiresIn: 60 });
    expect((await call(url)).status).toBe(404);
  });
});
