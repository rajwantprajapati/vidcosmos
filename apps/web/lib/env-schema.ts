// The environment contract (SDD §18). `parseEnv` is pure so it can be tested;
// `apps/web/env.ts` runs it once on `process.env` at start-up.
//
// Rules:
// - An empty value (`KEY=`) counts as unset.
// - `PROVIDERS` sets every provider to `stub` or `live`; `PROVIDERS_<NAME>` overrides one provider.
// - Keys for a provider are required only when that provider is live.
// - Error messages name the variable and the rule, never the value.
import { z } from "zod";

export const providerNames = ["llm", "tts", "render", "storage", "instagram", "email"] as const;
export type ProviderName = (typeof providerNames)[number];

const providerMode = z.enum(["stub", "live"], { error: "must be `stub` or `live`" });
export type ProviderMode = z.infer<typeof providerMode>;

/** The per-provider override variable, e.g. `PROVIDERS_LLM`. */
export const providerOverrideVariable = (name: ProviderName) =>
  `PROVIDERS_${name.toUpperCase()}` as `PROVIDERS_${Uppercase<ProviderName>}`;

/** Instagram token keys are versioned: TOKEN_ENC_KEY_V1, TOKEN_ENC_KEY_V2, … (DB §security). */
export const tokenKeyPattern = /^TOKEN_ENC_KEY_V([1-9][0-9]*)$/;

const url = (message = "must be a full http(s) URL, e.g. https://example.com") =>
  z.url({ protocol: /^https?$/, error: message });

const emailFrom = z
  .string()
  .regex(/^(?:[^<>]+<[^<>\s@]+@[^<>\s@]+\.[^<>\s@]+>|[^<>\s@]+@[^<>\s@]+\.[^<>\s@]+)$/, {
    error: "must be an email address, or `Name <address>`",
  });

const schema = z.object({
  PROVIDERS: providerMode,
  PROVIDERS_LLM: providerMode.optional(),
  PROVIDERS_TTS: providerMode.optional(),
  PROVIDERS_RENDER: providerMode.optional(),
  PROVIDERS_STORAGE: providerMode.optional(),
  PROVIDERS_INSTAGRAM: providerMode.optional(),
  PROVIDERS_EMAIL: providerMode.optional(),

  // Database
  MONGODB_URI: z.string().regex(/^mongodb(\+srv)?:\/\/\S+$/, {
    error: "must start with mongodb:// or mongodb+srv://",
  }),

  // Auth (Better Auth)
  BETTER_AUTH_SECRET: z.string().min(32, {
    error: "must be at least 32 characters (generate one with `openssl rand -base64 32`)",
  }),
  BETTER_AUTH_URL: url().default("http://localhost:3000"),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  // Jobs (Inngest). Not needed with the local Inngest Dev Server.
  INNGEST_EVENT_KEY: z.string().optional(),
  INNGEST_SIGNING_KEY: z.string().optional(),

  // LLM
  LLM_PROVIDER: z
    .enum(["gemini", "claude"], { error: "must be `gemini` or `claude`" })
    .default("gemini"),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default("gemini-3.8-flash"),
  GEMINI_MODEL_SMALL: z.string().default("gemini-3.5-flash-lite"),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().optional(),
  ANTHROPIC_MODEL_SMALL: z.string().optional(),

  // Voice (ElevenLabs)
  ELEVENLABS_API_KEY: z.string().optional(),
  ELEVENLABS_MODEL: z.string().default("eleven_multilingual_v2"),
  ELEVENLABS_VOICE_ID_MALE: z.string().default("pOk40AXK0gYhreBApvj7"),
  ELEVENLABS_VOICE_ID_FEMALE: z.string().default("tLGhEubY0Pyc5mxjkJSJ"),

  // Render (Vercel Sandbox). Provided by Vercel, or by `vercel env pull` locally.
  VERCEL_OIDC_TOKEN: z.string().optional(),

  // Storage (Cloudflare R2)
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET: z
    .string()
    .regex(/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/, {
      error: "must be 3-63 lowercase letters, digits or hyphens",
    })
    .default("vidcosmos-dev"),

  // Instagram (Meta app, Instagram Login)
  IG_APP_ID: z.string().optional(),
  IG_APP_SECRET: z.string().optional(),
  IG_REDIRECT_URI: url().default("http://localhost:3000/api/v1/integrations/instagram/callback"),
  IG_API_VERSION: z
    .string()
    .regex(/^v\d+\.\d+$/, { error: "must look like v24.0" })
    .optional(),

  // Email (Resend)
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: emailFrom.optional(),

  // Monitoring
  SENTRY_DSN: url().optional(),
  SENTRY_AUTH_TOKEN: z.string().optional(),
  NEXT_PUBLIC_POSTHOG_KEY: z.string().optional(),
  NEXT_PUBLIC_POSTHOG_HOST: url().optional(),

  // Vercel Cron
  CRON_SECRET: z.string().min(16, { error: "must be at least 16 characters" }).optional(),

  // Later: Remotion company license once the team is over 3 people
  REMOTION_LICENSE_KEY: z.string().optional(),
});

/** Every fixed variable name the app reads. Versioned token keys follow `tokenKeyPattern`. */
export const envVariableNames = Object.keys(schema.shape) as (keyof z.infer<typeof schema>)[];

/** Old names that must not hold a value any more. */
const renamedVariables: Record<string, string> = {
  TOKEN_ENCRYPTION_KEY: "TOKEN_ENC_KEY_V1",
};

/** Variables each provider needs when it is live. */
function requiredWhenLive(name: ProviderName, values: Readonly<Record<string, string>>): string[] {
  switch (name) {
    case "llm":
      return values.LLM_PROVIDER === "claude"
        ? ["ANTHROPIC_API_KEY", "ANTHROPIC_MODEL"]
        : ["GEMINI_API_KEY"];
    case "tts":
      return ["ELEVENLABS_API_KEY"];
    case "render":
      return ["VERCEL_OIDC_TOKEN"];
    case "storage":
      return ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"];
    case "instagram":
      return ["IG_APP_ID", "IG_APP_SECRET", "IG_API_VERSION"];
    case "email":
      return ["RESEND_API_KEY", "EMAIL_FROM"];
  }
}

export type TokenEncryptionKeys = {
  /** Version used for new tokens: the highest one set. */
  currentVersion: number;
  /** Every configured key by version, so older tokens can still be decrypted. */
  keys: ReadonlyMap<number, Buffer>;
};

export type Env = z.infer<typeof schema> & {
  /** The resolved mode of every provider after `PROVIDERS_<NAME>` overrides. */
  providers: Readonly<Record<ProviderName, ProviderMode>>;
  /** Undefined when no TOKEN_ENC_KEY_V{n} is set (allowed while Instagram is stub). */
  tokenEncryptionKeys: TokenEncryptionKeys | undefined;
};

export type EnvIssue = { variable: string; message: string };

export class EnvError extends Error {
  readonly issues: readonly EnvIssue[];

  constructor(issues: EnvIssue[]) {
    const lines = issues.map((issue) => `  - ${issue.variable}: ${issue.message}`);
    super(
      [
        `Invalid environment configuration (${issues.length} ${issues.length === 1 ? "problem" : "problems"}):`,
        ...lines,
        "Fix these in .env (see .env.example for every variable).",
      ].join("\n"),
    );
    this.name = "EnvError";
    this.issues = issues;
  }
}

type Source = Readonly<Record<string, string | undefined>>;

/** Validate the environment. Throws `EnvError` listing every problem at once. */
export function parseEnv(source: Source): Env {
  // `KEY=` in a .env file arrives as "", which means "not set".
  const values: Record<string, string> = {};
  for (const [key, value] of Object.entries(source)) {
    if (value !== undefined && value.trim() !== "") values[key] = value.trim();
  }

  const issues: EnvIssue[] = [];

  const parsed = schema.safeParse(values);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const variable = String(issue.path[0] ?? "(unknown)");
      const missing = values[variable] === undefined;
      issues.push({ variable, message: missing ? "is required but not set" : issue.message });
    }
  }

  for (const [oldName, newName] of Object.entries(renamedVariables)) {
    if (values[oldName] !== undefined) {
      issues.push({ variable: oldName, message: `was renamed; move the value to ${newName}` });
    }
  }

  const keys = new Map<number, Buffer>();
  for (const [key, value] of Object.entries(values)) {
    const match = tokenKeyPattern.exec(key);
    if (!match) continue;
    const bytes = Buffer.from(value, "base64");
    if (bytes.length !== 32 || bytes.toString("base64") !== value) {
      issues.push({
        variable: key,
        message: "must be 32 bytes, base64-encoded (generate one with `openssl rand -base64 32`)",
      });
      continue;
    }
    keys.set(Number(match[1]), bytes);
  }

  // These checks read the raw values, so they run (and report) even when the
  // schema found other problems: every problem is listed in one go.
  const isMode = (value: string | undefined): value is ProviderMode =>
    value === "stub" || value === "live";
  const providers = {} as Record<ProviderName, ProviderMode>;
  for (const name of providerNames) {
    const overrideVariable = providerOverrideVariable(name);
    const override = values[overrideVariable];
    const mode = isMode(override) ? override : values.PROVIDERS;
    if (!isMode(mode)) continue; // already reported by the schema
    providers[name] = mode;
    if (mode !== "live") continue;

    const because = isMode(override) ? `${overrideVariable}=live` : "PROVIDERS=live";
    for (const variable of requiredWhenLive(name, values)) {
      if (values[variable] === undefined) {
        issues.push({
          variable,
          message: `is required because ${because}; set it, or set ${overrideVariable}=stub`,
        });
      }
    }
    const anyTokenKeySet = Object.keys(values).some((key) => tokenKeyPattern.test(key));
    if (name === "instagram" && !anyTokenKeySet) {
      issues.push({
        variable: "TOKEN_ENC_KEY_V1",
        message: `is required because ${because}; set it, or set ${overrideVariable}=stub`,
      });
    }
  }

  if ((values.GOOGLE_CLIENT_ID === undefined) !== (values.GOOGLE_CLIENT_SECRET === undefined)) {
    const unset =
      values.GOOGLE_CLIENT_ID === undefined ? "GOOGLE_CLIENT_ID" : "GOOGLE_CLIENT_SECRET";
    issues.push({
      variable: unset,
      message: "must be set together with the other Google variable (or leave both empty)",
    });
  }

  if (!parsed.success || issues.length > 0) throw new EnvError(issues);

  return {
    ...parsed.data,
    providers,
    tokenEncryptionKeys:
      keys.size === 0 ? undefined : { currentVersion: Math.max(...keys.keys()), keys },
  };
}

/** One line for the start-up log, e.g. `llm=stub tts=live …`. Contains no secrets. */
export function describeProviders(env: Pick<Env, "providers">): string {
  return providerNames.map((name) => `${name}=${env.providers[name]}`).join(" ");
}
