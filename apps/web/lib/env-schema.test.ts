import { describe, expect, it } from "vitest";
import { describeProviders, EnvError, parseEnv, providerNames } from "./env-schema";

const SECRET = "test-secret-that-is-at-least-32-chars-long";
const KEY_A = Buffer.alloc(32, 1).toString("base64");
const KEY_B = Buffer.alloc(32, 2).toString("base64");

/** The smallest setup that must start: the three variables from F02's "Done when". */
const minimal = {
  PROVIDERS: "stub",
  MONGODB_URI: "mongodb://localhost:27017/vidcosmos",
  BETTER_AUTH_SECRET: SECRET,
};

function issuesOf(source: Record<string, string | undefined>) {
  try {
    parseEnv(source);
  } catch (error) {
    if (error instanceof EnvError) return error;
    throw error;
  }
  throw new Error("expected parseEnv to throw");
}

describe("parseEnv: minimal stub setup", () => {
  it("starts with only PROVIDERS, MONGODB_URI and BETTER_AUTH_SECRET", () => {
    const env = parseEnv(minimal);
    for (const name of providerNames) expect(env.providers[name]).toBe("stub");
    expect(env.tokenEncryptionKeys).toBeUndefined();
  });

  it("fills in documented defaults", () => {
    const env = parseEnv(minimal);
    expect(env.BETTER_AUTH_URL).toBe("http://localhost:3000");
    expect(env.LLM_PROVIDER).toBe("gemini");
    expect(env.GEMINI_MODEL).toBe("gemini-3.8-flash");
    expect(env.ELEVENLABS_MODEL).toBe("eleven_multilingual_v2");
    expect(env.R2_BUCKET).toBe("vidcosmos-dev");
  });

  it("treats empty values as unset, like `KEY=` in .env", () => {
    const env = parseEnv({ ...minimal, GEMINI_API_KEY: "", SENTRY_DSN: "  ", BETTER_AUTH_URL: "" });
    expect(env.GEMINI_API_KEY).toBeUndefined();
    expect(env.SENTRY_DSN).toBeUndefined();
    expect(env.BETTER_AUTH_URL).toBe("http://localhost:3000");
  });
});

describe("parseEnv: missing required variables", () => {
  it.each(["PROVIDERS", "MONGODB_URI", "BETTER_AUTH_SECRET"])(
    "fails with a clear message when %s is missing",
    (variable) => {
      const error = issuesOf({ ...minimal, [variable]: undefined });
      expect(error.issues).toEqual([{ variable, message: "is required but not set" }]);
      expect(error.message).toContain(`- ${variable}: is required but not set`);
      expect(error.message).toContain("see .env.example");
    },
  );

  it("lists every problem at once", () => {
    const error = issuesOf({});
    expect(error.issues.map((issue) => issue.variable).sort()).toEqual([
      "BETTER_AUTH_SECRET",
      "MONGODB_URI",
      "PROVIDERS",
    ]);
    expect(error.message).toMatch(/^Invalid environment configuration \(3 problems\):/);
  });
});

describe("parseEnv: bad values", () => {
  it.each([
    ["PROVIDERS", "on", "must be `stub` or `live`"],
    ["PROVIDERS_LLM", "yes", "must be `stub` or `live`"],
    ["MONGODB_URI", "postgres://localhost/db", "must start with mongodb:// or mongodb+srv://"],
    ["BETTER_AUTH_SECRET", "short", "at least 32 characters"],
    ["BETTER_AUTH_URL", "localhost:3000", "must be a full http(s) URL"],
    ["LLM_PROVIDER", "openai", "must be `gemini` or `claude`"],
    ["R2_BUCKET", "Vidcosmos_Dev", "lowercase"],
    ["IG_API_VERSION", "24", "must look like v24.0"],
    ["EMAIL_FROM", "not an email", "email address"],
    ["CRON_SECRET", "abc", "at least 16 characters"],
    ["TOKEN_ENC_KEY_V1", "bm90LTMyLWJ5dGVz", "32 bytes, base64"],
  ])("rejects %s=%s", (variable, value, expected) => {
    const error = issuesOf({ ...minimal, [variable]: value });
    expect(error.issues).toHaveLength(1);
    expect(error.issues[0]?.variable).toBe(variable);
    expect(error.issues[0]?.message).toContain(expected);
  });

  it("never prints the value of a variable", () => {
    const value = "super-secret-value";
    const error = issuesOf({ ...minimal, BETTER_AUTH_SECRET: value, MONGODB_URI: value });
    expect(error.message).not.toContain(value);
  });

  it("accepts EMAIL_FROM as an address or `Name <address>`", () => {
    expect(parseEnv({ ...minimal, EMAIL_FROM: "hello@vidcosmos.app" }).EMAIL_FROM).toBeDefined();
    expect(parseEnv({ ...minimal, EMAIL_FROM: "Vidcosmos <hello@vidcosmos.app>" }).EMAIL_FROM).toBe(
      "Vidcosmos <hello@vidcosmos.app>",
    );
  });

  it("requires both Google variables or neither", () => {
    const error = issuesOf({ ...minimal, GOOGLE_CLIENT_ID: "id" });
    expect(error.issues).toEqual([
      { variable: "GOOGLE_CLIENT_SECRET", message: expect.stringContaining("together") },
    ]);
    expect(
      parseEnv({ ...minimal, GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "s" }),
    ).toBeDefined();
  });

  it("refuses a value in the renamed TOKEN_ENCRYPTION_KEY", () => {
    const error = issuesOf({ ...minimal, TOKEN_ENCRYPTION_KEY: KEY_A });
    expect(error.issues[0]?.message).toContain("TOKEN_ENC_KEY_V1");
  });
});

describe("parseEnv: live providers", () => {
  const liveKeys = {
    GEMINI_API_KEY: "g",
    ELEVENLABS_API_KEY: "e",
    VERCEL_OIDC_TOKEN: "v",
    R2_ACCOUNT_ID: "a",
    R2_ACCESS_KEY_ID: "k",
    R2_SECRET_ACCESS_KEY: "s",
    IG_APP_ID: "1",
    IG_APP_SECRET: "2",
    IG_API_VERSION: "v24.0",
    TOKEN_ENC_KEY_V1: KEY_A,
    RESEND_API_KEY: "r",
    EMAIL_FROM: "hello@vidcosmos.app",
  };

  it("requires every provider's keys when PROVIDERS=live", () => {
    const error = issuesOf({ ...minimal, PROVIDERS: "live" });
    expect(error.issues.map((issue) => issue.variable).sort()).toEqual(
      Object.keys(liveKeys).sort(),
    );
    expect(error.issues[0]?.message).toContain("because PROVIDERS=live");
  });

  it("starts when PROVIDERS=live and every key is set", () => {
    const env = parseEnv({ ...minimal, PROVIDERS: "live", ...liveKeys });
    for (const name of providerNames) expect(env.providers[name]).toBe("live");
  });

  it("lets one provider go live while the rest stay stub", () => {
    const env = parseEnv({ ...minimal, PROVIDERS_LLM: "live", GEMINI_API_KEY: "g" });
    expect(env.providers.llm).toBe("live");
    expect(env.providers.instagram).toBe("stub");
    expect(describeProviders(env)).toBe(
      "llm=live tts=stub render=stub storage=stub instagram=stub email=stub",
    );
  });

  it("lets one provider stay stub while the rest go live", () => {
    const {
      IG_APP_ID: _1,
      IG_APP_SECRET: _2,
      IG_API_VERSION: _3,
      TOKEN_ENC_KEY_V1: _4,
      ...rest
    } = liveKeys;
    const env = parseEnv({ ...minimal, PROVIDERS: "live", PROVIDERS_INSTAGRAM: "stub", ...rest });
    expect(env.providers.instagram).toBe("stub");
    expect(env.providers.llm).toBe("live");
  });

  it("names the override in the message when an override made a provider live", () => {
    const error = issuesOf({ ...minimal, PROVIDERS_TTS: "live" });
    expect(error.issues).toEqual([
      {
        variable: "ELEVENLABS_API_KEY",
        message: "is required because PROVIDERS_TTS=live; set it, or set PROVIDERS_TTS=stub",
      },
    ]);
  });

  it("reports missing live keys together with other problems", () => {
    const error = issuesOf({ ...minimal, MONGODB_URI: undefined, PROVIDERS_LLM: "live" });
    expect(error.issues.map((issue) => issue.variable).sort()).toEqual([
      "GEMINI_API_KEY",
      "MONGODB_URI",
    ]);
  });

  it("asks for the Claude key and model when LLM_PROVIDER=claude", () => {
    const error = issuesOf({ ...minimal, PROVIDERS_LLM: "live", LLM_PROVIDER: "claude" });
    expect(error.issues.map((issue) => issue.variable)).toEqual([
      "ANTHROPIC_API_KEY",
      "ANTHROPIC_MODEL",
    ]);
  });
});

describe("parseEnv: Instagram token keys", () => {
  it("reads every TOKEN_ENC_KEY_V{n} and uses the highest for new tokens", () => {
    const env = parseEnv({ ...minimal, TOKEN_ENC_KEY_V1: KEY_A, TOKEN_ENC_KEY_V2: KEY_B });
    expect(env.tokenEncryptionKeys?.currentVersion).toBe(2);
    expect(env.tokenEncryptionKeys?.keys.get(1)).toEqual(Buffer.alloc(32, 1));
    expect(env.tokenEncryptionKeys?.keys.get(2)).toEqual(Buffer.alloc(32, 2));
  });
});
