import { describe, expect, it } from "vitest";
import { databaseNameFromUri, mongoClientOptions } from "./client.ts";

describe("databaseNameFromUri", () => {
  it.each([
    ["mongodb://localhost:27017/vidcosmos?directConnection=true", "vidcosmos"],
    ["mongodb://localhost:27017/vidcosmos-ci", "vidcosmos-ci"],
    ["mongodb+srv://app:secret@cluster0.abcde.mongodb.net/vidcosmos?retryWrites=true", "vidcosmos"],
    [
      "mongodb+srv://app:secret@cluster0.abcde.mongodb.net/?retryWrites=true&w=majority",
      "vidcosmos",
    ],
    ["mongodb+srv://app:secret@cluster0.abcde.mongodb.net", "vidcosmos"],
    ["mongodb://h1:27017,h2:27017/staging?replicaSet=rs0", "staging"],
  ])("%s -> %s", (uri, name) => {
    expect(databaseNameFromUri(uri)).toBe(name);
  });
});

describe("mongoClientOptions", () => {
  it("keeps the serverless pool small and writes with majority (DB §11, §14)", () => {
    expect(mongoClientOptions).toMatchObject({
      maxPoolSize: 5,
      minPoolSize: 0,
      maxIdleTimeMS: 60_000,
      writeConcern: { w: "majority" },
    });
  });
});
