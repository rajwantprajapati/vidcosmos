// F12: the live R2 store against a real bucket. Skipped unless R2_ACCOUNT_ID,
// R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_BUCKET are set (from the root .env); it writes
// only under `dev/integration-test/` and deletes what it wrote.
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { urlLifetimes } from "./artifact-store.ts";
import { createR2ArtifactStore } from "./r2.ts";

try {
  process.loadEnvFile(new URL("../../../../.env", import.meta.url));
} catch {
  // No .env: the test stays skipped.
}

const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env;
const configured = Boolean(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET);

describe.skipIf(!configured)("R2 (live)", () => {
  const store = createR2ArtifactStore({
    accountId: R2_ACCOUNT_ID ?? "",
    accessKeyId: R2_ACCESS_KEY_ID ?? "",
    secretAccessKey: R2_SECRET_ACCESS_KEY ?? "",
    bucket: R2_BUCKET ?? "",
  });
  const prefix = `dev/integration-test/${randomUUID()}/`;
  const key = `${prefix}hello.txt`;

  afterAll(async () => {
    await store.deletePrefix(prefix);
  });

  it("puts, signs and gets a file, accepts a signed PUT, and deletes", async () => {
    await store.put(key, new TextEncoder().encode("hello r2"), { contentType: "text/plain" });
    expect(await store.head(key)).toEqual({ contentType: "text/plain", bytes: 8 });

    const get = await store.signGet(key, {
      expiresIn: urlLifetimes.download,
      downloadAs: "hello.txt",
    });
    const fetched = await fetch(get.url);
    expect(fetched.status).toBe(200);
    expect(await fetched.text()).toBe("hello r2");
    expect(fetched.headers.get("content-disposition")).toContain("hello.txt");

    const ranged = await fetch(get.url, { headers: { Range: "bytes=0-4" } });
    expect(ranged.status).toBe(206);
    expect(await ranged.text()).toBe("hello");

    const upload = `${prefix}upload.txt`;
    const put = await store.signPut(upload, {
      expiresIn: urlLifetimes.renderOutput,
      contentType: "text/plain",
    });
    const uploaded = await fetch(put.url, {
      method: "PUT",
      body: "uploaded",
      headers: { "Content-Type": "text/plain" },
    });
    expect(uploaded.status).toBe(200);
    expect(new TextDecoder().decode((await store.get(upload))!.body)).toBe("uploaded");

    await store.delete(key);
    expect(await store.get(key)).toBeNull();
    expect(await store.deletePrefix(prefix)).toBe(1);
  });
});
