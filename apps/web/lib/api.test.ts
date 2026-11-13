import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

vi.mock("server-only", () => ({}));
vi.mock("@/env", () => ({ env: { BETTER_AUTH_URL: "http://localhost:3000" } }));
vi.mock("./auth", () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock("./db", () => ({ getDb: vi.fn() }));
vi.mock("@vidcosmos/db", () => ({
  ensureWorkspace: vi.fn(),
  ObjectId: class {},
  IdempotencyError: class extends Error {},
  ProjectError: class extends Error {},
  JobError: class extends Error {},
}));

const { ApiError, editorId, idempotencyKey, readJson, readQuery } = await import("./api");

const schema = z.object({ name: z.string().max(5) });
const request = (body: string) => new Request("http://localhost:3000/x", { method: "PUT", body });

describe("readJson", () => {
  it("returns the parsed body", async () => {
    await expect(readJson(request('{"name":"Asha"}'), schema)).resolves.toEqual({ name: "Asha" });
  });

  it("refuses invalid JSON", async () => {
    await expect(readJson(request("{"), schema)).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
    });
  });

  it("lists every field that fails, by path", async () => {
    const error = await readJson(request('{"name":"Too long"}'), schema).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as InstanceType<typeof ApiError>).fields).toEqual([
      { path: "name", message: expect.any(String) },
    ]);
  });

  it.each([
    ['{"$where":"1"}', "$where"],
    ['{"name":"x","a":{"b.c":1}}', "a.b.c"],
    ['{"list":[{"$gt":1}]}', "list[0].$gt"],
  ])("refuses operator keys in %s", async (body, path) => {
    const error = (await readJson(request(body), schema).catch((e: unknown) => e)) as InstanceType<
      typeof ApiError
    >;
    expect(error.code).toBe("VALIDATION_FAILED");
    expect(error.fields?.[0]?.path).toBe(path);
  });

  it("refuses bodies over 256 KB", async () => {
    const big = JSON.stringify({ name: "x".repeat(300 * 1024) });
    await expect(readJson(request(big), schema)).rejects.toMatchObject({
      code: "PAYLOAD_TOO_LARGE",
    });
  });
});

describe("readQuery", () => {
  const query = z.object({ stage: z.array(z.string()).optional(), q: z.string().optional() });
  it("turns repeated parameters into a list", () => {
    const request = new Request("http://localhost:3000/x?stage=ready&stage=draft&q=upi");
    expect(readQuery(request, query)).toEqual({ stage: ["ready", "draft"], q: "upi" });
  });
});

describe("headers", () => {
  it("X-Editor-Id is required", () => {
    expect(editorId(new Request("http://x/", { headers: { "X-Editor-Id": "tab-1" } }))).toBe(
      "tab-1",
    );
    expect(() => editorId(new Request("http://x/"))).toThrow(ApiError);
  });

  it("Idempotency-Key is required where the API says so", () => {
    const withKey = new Request("http://x/", { headers: { "Idempotency-Key": "k" } });
    expect(idempotencyKey(withKey, true)).toBe("k");
    expect(idempotencyKey(new Request("http://x/"), false)).toBeNull();
    expect(() => idempotencyKey(new Request("http://x/"), true)).toThrow(ApiError);
  });
});
