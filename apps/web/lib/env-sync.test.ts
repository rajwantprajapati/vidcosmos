// Keeps the three lists of variables in step: the schema, .env.example and turbo.json.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { envVariableNames, parseEnv, tokenKeyPattern } from "./env-schema";

const root = path.resolve(import.meta.dirname, "../../..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

const exampleNames = read(".env.example")
  .split("\n")
  .map((line) => /^([A-Z][A-Z0-9_]*)=/.exec(line)?.[1])
  .filter((name): name is string => name !== undefined);

describe("environment variables stay in sync", () => {
  it(".env.example lists exactly the schema's variables", () => {
    const fixed = exampleNames.filter((name) => !tokenKeyPattern.test(name));
    expect([...fixed].sort()).toEqual([...envVariableNames].sort());
    expect(exampleNames).toContain("TOKEN_ENC_KEY_V1");
  });

  it("turbo.json lists every variable, so a change invalidates the cache", () => {
    const turbo = JSON.parse(read("turbo.json")) as { globalEnv: string[] };
    expect([...turbo.globalEnv].sort()).toEqual([...envVariableNames, "TOKEN_ENC_KEY_V*"].sort());
  });

  it(".env.example starts the app once BETTER_AUTH_SECRET is filled in", () => {
    const values = Object.fromEntries(
      read(".env.example")
        .split("\n")
        .map((line) => /^([A-Z][A-Z0-9_]*)=([^#\s]*)/.exec(line))
        .filter((match): match is RegExpExecArray => match !== null)
        .map((match) => [match[1], match[2]]),
    );
    const env = parseEnv({ ...values, BETTER_AUTH_SECRET: "x".repeat(32) });
    expect(env.PROVIDERS).toBe("stub");
  });

  it(".env is ignored by git", () => {
    const output = execFileSync("git", ["check-ignore", ".env", "apps/web/.env"], {
      cwd: root,
      encoding: "utf8",
    });
    expect(output.split("\n").filter(Boolean)).toEqual([".env", "apps/web/.env"]);
  });
});
