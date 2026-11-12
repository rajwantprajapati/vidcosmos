import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

vi.mock("server-only", () => ({}));
vi.mock("@/env", () => ({ env: { BETTER_AUTH_URL: "http://localhost:3000" } }));
vi.mock("./auth", () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock("./db", () => ({ getDb: vi.fn() }));

const { ApiError, readJson } = await import("./api");

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
