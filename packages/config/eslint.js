// Shared ESLint flat config for every workspace package.
import js from "@eslint/js";
import prettier from "eslint-config-prettier";

export { prettier };
import globals from "globals";
import tseslint from "typescript-eslint";

export const ignores = {
  ignores: ["**/node_modules/**", "**/dist/**", "**/.next/**", "**/.turbo/**", "**/coverage/**"],
};

/** Rules for every TypeScript package (Next.js adds its own on top). */
export const typescriptRules = {
  rules: {
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/consistent-type-imports": "error",
    "@typescript-eslint/no-unused-vars": [
      "error",
      { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
    ],
  },
};

/** Packages must stay pure: nothing in packages/* may import from apps/. */
export const noAppImports = {
  rules: {
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          {
            group: ["@vidcosmos/web", "@vidcosmos/web/*", "**/apps/**"],
            message: "packages/* never import from apps/.",
          },
        ],
      },
    ],
  },
};

export default tseslint.config(
  ignores,
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { languageOptions: { globals: { ...globals.node } } },
  typescriptRules,
  noAppImports,
  prettier,
);
