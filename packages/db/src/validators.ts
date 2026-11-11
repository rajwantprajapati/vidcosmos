// zod schema -> MongoDB `$jsonSchema` validator (DB §13, "Two layers of validation").
//
// zod is the source of truth. `z.toJSONSchema` gives draft-4 JSON Schema, which this file
// turns into MongoDB's dialect: `bsonType` instead of `type`, ObjectId and Date as BSON types,
// and only the keywords MongoDB supports. Unknown fields are allowed (no `additionalProperties`),
// so the validator checks required fields and types, as DB §1 says.
import { collectionSchemas, type CollectionName } from "@vidcosmos/spec/collections";
import { z } from "zod";

type JsonSchema = { [key: string]: unknown };

/** JSON Schema `type` -> MongoDB `bsonType`. `number` matches int, long, double and decimal. */
const bsonTypes: Record<string, string> = {
  object: "object",
  array: "array",
  string: "string",
  boolean: "bool",
  number: "number",
  integer: "number",
  null: "null",
};

/** Keywords MongoDB's `$jsonSchema` accepts that zod emits. Everything else is dropped. */
const keptKeywords = new Set([
  "bsonType",
  "required",
  "enum",
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "minLength",
  "maxLength",
  "pattern",
  "minItems",
  "maxItems",
  "uniqueItems",
  "description",
]);

function convert(schema: JsonSchema): JsonSchema {
  const out: JsonSchema = {};
  for (const [key, value] of Object.entries(schema)) {
    if (key === "type") {
      const types = (Array.isArray(value) ? value : [value]).map((t) => {
        const mapped = bsonTypes[String(t)];
        if (!mapped) throw new Error(`No BSON type for JSON Schema type "${String(t)}"`);
        return mapped;
      });
      // An explicit bsonType from metadata (objectId, date) wins over the JSON type.
      if (schema.bsonType === undefined) out.bsonType = types.length === 1 ? types[0] : types;
    } else if (key === "properties") {
      if (Object.keys(value as object).length === 0) continue;
      out.properties = Object.fromEntries(
        Object.entries(value as Record<string, JsonSchema>).map(([name, sub]) => [
          name,
          convert(sub),
        ]),
      );
    } else if (key === "items") {
      out.items = convert(value as JsonSchema);
    } else if (key === "anyOf" || key === "oneOf" || key === "allOf") {
      // oneOf would reject a value matching two branches; anyOf is enough for a backstop.
      const branches = (value as JsonSchema[]).map(convert);
      out[key === "allOf" ? "allOf" : "anyOf"] = branches;
    } else if (keptKeywords.has(key)) {
      out[key] = value;
    }
  }
  return out;
}

/** The MongoDB `$jsonSchema` for a zod schema. */
export function toMongoJsonSchema(schema: z.ZodType): JsonSchema {
  const json = z.toJSONSchema(schema, {
    target: "draft-4",
    // Dates have no JSON Schema form; they are filled in by `override` below.
    unrepresentable: "any",
    override(ctx) {
      const def = (ctx.zodSchema as { _zod: { def: { type: string } } })._zod.def;
      if (def.type === "date") ctx.jsonSchema.bsonType = "date";
    },
  }) as JsonSchema;
  return convert(json);
}

/** The `validator` option for a collection: `{ $jsonSchema }`. */
export function validatorFor(name: CollectionName): { $jsonSchema: JsonSchema } {
  // A union of document shapes (migrations) has no top-level type; every document is an object.
  return { $jsonSchema: { bsonType: "object", ...toMongoJsonSchema(collectionSchemas[name]) } };
}

/** DB §13: `moderate` so old documents can still get unrelated updates; `error` rejects bad writes. */
export const validationOptions = {
  validationLevel: "moderate",
  validationAction: "error",
} as const;
