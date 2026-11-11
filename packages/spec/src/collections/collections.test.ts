import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  collectionNames,
  collectionSchemas,
  isObjectId,
  workspaceScopedCollections,
} from "./index.ts";

/** Top-level fields of a collection schema (a union's first branch for migrations). */
function fields(schema: z.ZodType): string[] {
  const object = schema instanceof z.ZodUnion ? schema.options[0] : schema;
  return Object.keys((object as z.ZodObject).shape);
}

describe("collection schemas", () => {
  it("cover the 15 app collections (DB §1)", () => {
    expect(collectionNames).toHaveLength(15);
  });

  it("put workspaceId on every workspace-scoped collection", () => {
    for (const name of workspaceScopedCollections) {
      expect(fields(collectionSchemas[name]), name).toContain("workspaceId");
    }
  });

  it("leave out workspaceId only where DB §1 says so", () => {
    const unscoped = collectionNames.filter(
      (name) => !fields(collectionSchemas[name]).includes("workspaceId"),
    );
    expect(unscoped.sort()).toEqual(["admin_audit", "migrations", "workspaces"]);
  });

  it("give every app document a schemaVersion (DB §1)", () => {
    for (const name of collectionNames.filter((n) => n !== "migrations")) {
      expect(fields(collectionSchemas[name]), name).toContain("schemaVersion");
    }
  });
});

describe("isObjectId", () => {
  it("recognises ObjectIds by their BSON type, not their class", () => {
    expect(isObjectId({ _bsontype: "ObjectId" })).toBe(true);
    expect(isObjectId("6740a1b2c3d4e5f601234567")).toBe(false);
    expect(isObjectId(null)).toBe(false);
    expect(isObjectId({ _bsontype: "Long" })).toBe(false);
  });
});
