// The repository keeps one .env at its root, but Next.js only reads .env files in
// apps/web. Load the root ones too. Values already in the environment (CI, Vercel) win.
import path from "node:path";
import { loadEnvConfig } from "@next/env";

const repoRoot = path.resolve(import.meta.dirname, "../..");
const dev = process.env.NODE_ENV !== "production";
// forceReload: Next has already called loadEnvConfig for apps/web, and the result is cached.
loadEnvConfig(repoRoot, dev, { info: () => {}, error: console.error }, true);
