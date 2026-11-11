import { describe, expect, it, vi } from "vitest";

vi.mock("@/env", () => ({
  env: { MONGODB_URI: "mongodb://localhost:27017/vidcosmos-test?directConnection=true" },
}));

const { getDb, getMongoClient } = await import("./db");

describe("lib/db", () => {
  it("reuses one client per server instance", () => {
    expect(getMongoClient()).toBe(getMongoClient());
  });

  it("uses the database named in MONGODB_URI", () => {
    expect(getDb().databaseName).toBe("vidcosmos-test");
  });

  it("keeps the serverless pool small", () => {
    expect(getMongoClient().options.maxPoolSize).toBe(5);
    expect(getMongoClient().options.minPoolSize).toBe(0);
  });
});
