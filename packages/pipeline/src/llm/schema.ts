// From zod to the JSON Schema each provider accepts. zod stays the contract: whatever a provider
// can't enforce (lengths, ranges, patterns) is dropped from what it sees and checked by zod after.
import { z } from "zod";

/** The JSON Schema of a zod schema, without `$schema` and without `omit` fields (filled later). */
export function toJsonSchema(
  schema: z.ZodType,
  omit: readonly string[] = [],
): Record<string, unknown> {
  const skip = new Set(omit);
  const strip = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(strip);
    if (!node || typeof node !== "object") return node;
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(node)) {
      if (key === "$schema") continue;
      if (key === "properties" && value && typeof value === "object") {
        out[key] = Object.fromEntries(
          Object.entries(value as Record<string, unknown>)
            .filter(([name]) => !skip.has(name))
            .map(([name, child]) => [name, strip(child)]),
        );
      } else if (key === "required" && Array.isArray(value)) {
        out[key] = value.filter((name) => !skip.has(String(name)));
      } else {
        out[key] = strip(value);
      }
    }
    return out;
  };
  return strip(z.toJSONSchema(schema, { target: "draft-7" })) as Record<string, unknown>;
}

/**
 * Gemini's structured output accepts a subset of JSON Schema: `const` becomes `enum` and
 * `oneOf` becomes `anyOf`. Length limits are accepted but not enforced (zod checks them).
 */
export function toGeminiSchema(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(toGeminiSchema);
  if (!node || typeof node !== "object") return node;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    if (key === "const") out.enum = [value];
    else if (key === "oneOf") out.anyOf = toGeminiSchema(value);
    else out[key] = toGeminiSchema(value);
  }
  return out;
}

/** Keywords Claude's structured outputs don't support; zod checks them afterwards. */
const claudeUnsupported = new Set([
  "minLength",
  "maxLength",
  "pattern",
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "multipleOf",
  "minItems",
  "maxItems",
  "uniqueItems",
]);

/** Claude's structured outputs: no numeric or length limits, and every object closed. */
export function toClaudeSchema(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(toClaudeSchema);
  if (!node || typeof node !== "object") return node;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    if (claudeUnsupported.has(key)) continue;
    out[key] =
      key === "properties" || key === "definitions" || key === "$defs"
        ? Object.fromEntries(
            Object.entries(value as Record<string, unknown>).map(([name, child]) => [
              name,
              toClaudeSchema(child),
            ]),
          )
        : toClaudeSchema(value);
  }
  if (out.type === "object") out.additionalProperties = false;
  return out;
}
