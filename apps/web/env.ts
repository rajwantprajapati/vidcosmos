// The validated environment. Import `env` from here in server code; never read
// `process.env` directly. Validation runs once, when this module is first loaded.
import { parseEnv } from "./lib/env-schema";

export type { Env, ProviderMode, ProviderName } from "./lib/env-schema";

export const env = parseEnv(process.env);
