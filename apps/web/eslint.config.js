import { ignores, prettier, typescriptRules } from "@vidcosmos/config/eslint";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const config = [
  ignores,
  { ignores: ["next-env.d.ts", "playwright-report/**", "test-results/**"] },
  ...nextVitals,
  ...nextTs,
  typescriptRules,
  prettier,
];

export default config;
