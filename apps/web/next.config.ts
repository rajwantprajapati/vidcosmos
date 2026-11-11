import type { NextConfig } from "next";
// Order matters: load the root .env, then validate it, so a missing or bad
// setting stops `next dev` and `next build` before anything runs.
import "./load-root-env";
import { describeProviders, EnvError, parseEnv } from "./lib/env-schema";

try {
  const env = parseEnv(process.env);
  console.log(`Providers: ${describeProviders(env)}`);
} catch (error) {
  if (error instanceof EnvError) {
    console.error(`\n${error.message}\n`);
    process.exit(1);
  }
  throw error;
}

const nextConfig: NextConfig = {
  // Workspace packages ship TypeScript source; Next compiles them.
  transpilePackages: [
    "@vidcosmos/config",
    "@vidcosmos/spec",
    "@vidcosmos/video",
    "@vidcosmos/pipeline",
    "@vidcosmos/integrations",
  ],
};

export default nextConfig;
