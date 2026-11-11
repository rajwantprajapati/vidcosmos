import { collectionNames } from "@vidcosmos/spec/collections";
import { describe, expect, it } from "vitest";
import { validatorFor } from "./validators.ts";

type Json = { [key: string]: unknown };

/** Every keyword used anywhere in a schema tree. */
function keywords(schema: unknown, found = new Set<string>()): Set<string> {
  if (Array.isArray(schema)) schema.forEach((item) => keywords(item, found));
  else if (schema && typeof schema === "object") {
    for (const [key, value] of Object.entries(schema)) {
      if (key === "properties") Object.values(value as Json).forEach((s) => keywords(s, found));
      else {
        found.add(key);
        keywords(value, found);
      }
    }
  }
  return found;
}

describe("validatorFor", () => {
  it.each(collectionNames)("%s converts to MongoDB's $jsonSchema dialect", (name) => {
    const { $jsonSchema } = validatorFor(name);
    expect($jsonSchema.bsonType).toBe("object");
    expect($jsonSchema.required).toEqual(
      expect.arrayContaining(name === "migrations" ? [] : ["_id"]),
    );
    const used = keywords($jsonSchema);
    for (const unsupported of [
      "type",
      "$schema",
      "$ref",
      "definitions",
      "format",
      "default",
      "const",
      "additionalProperties",
    ]) {
      expect(used, `${name} uses ${unsupported}`).not.toContain(unsupported);
    }
  });

  it("maps ObjectIds, dates, nullables and integers to BSON types", () => {
    const { $jsonSchema } = validatorFor("projects");
    const properties = $jsonSchema.properties as Record<string, Json>;
    expect(properties._id).toEqual({ bsonType: "objectId" });
    expect(properties.createdAt).toEqual({ bsonType: "date" });
    expect(properties.deletedAt).toEqual({ anyOf: [{ bsonType: "date" }, { bsonType: "null" }] });
    expect(properties.revisionsUsed).toMatchObject({ bsonType: "number", minimum: 0 });
    expect(properties.stage).toEqual({
      bsonType: "string",
      enum: ["draft", "generating", "ready", "revising", "failed"],
    });
  });

  it("checks the embedded spec only at the top level (DB §13)", () => {
    const draft = (validatorFor("projects").$jsonSchema.properties as Record<string, Json>).draft;
    const spec = (draft?.properties as Record<string, Json>).spec as Json;
    const [object] = spec.anyOf as Json[];
    expect(object?.required).toEqual(["version", "scenes"]);
    expect((object?.properties as Record<string, Json>).scenes).toEqual({
      bsonType: "array",
      items: { bsonType: "object" },
    });
  });
});
