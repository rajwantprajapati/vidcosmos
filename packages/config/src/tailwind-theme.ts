// Builds packages/config/tailwind/theme.css from tokens.json: the Tailwind 4 theme for the app.
//
//   pnpm tokens          write the file
//   pnpm tokens --check  fail if the file is out of date (a unit test does the same)
//
// The token values live in design/design-system/tokens.css, which the app imports. This
// file only tells Tailwind which names exist: colours point at the semantic CSS variables
// (so they switch with data-theme), and Tailwind's default palette, radii, shadows, fonts
// and breakpoints are removed so only the design tokens can be used.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { repoRoot } from "./paths.ts";
import { type DesignTokens, designTokens, isSemanticColor } from "./tokens.ts";

export const themeCssPath = path.join(repoRoot, "packages/config/tailwind/theme.css");

/** Shadows switch per theme, so they are utilities on the variable rather than Tailwind theme values. */
const shadowUtility = (name: string) => `@utility ${name} {\n  box-shadow: var(--${name});\n}`;

function scalar(tokens: DesignTokens, section: "spacing" | "radius" | "layout", name: string) {
  const token = tokens[section].tokens.find((t) => t.name === name);
  if (!token) throw new Error(`tokens.json has no ${section} token "${name}"`);
  return token.value;
}

export function buildTailwindTheme(tokens: DesignTokens): string {
  const semantic = tokens.color.tokens.filter(isSemanticColor).map((t) => t.name);
  const colors = semantic.map((name) => `  --color-${name}: var(--${name});`);
  const radii = tokens.radius.tokens.map(
    (t) => `  --radius-${t.name.replace(/^radius-/, "")}: var(--${t.name});`,
  );

  const lines = [
    "/* Generated from design/design-system/tokens.json by `pnpm tokens`. Do not edit. */",
    "",
    "@theme {",
    "  /* Only design tokens: remove Tailwind's defaults for these namespaces. */",
    "  --color-*: initial;",
    "  --font-*: initial;",
    "  --radius-*: initial;",
    "  --shadow-*: initial;",
    "  --inset-shadow-*: initial;",
    "  --drop-shadow-*: initial;",
    "  --text-*: initial;",
    "  --breakpoint-*: initial;",
    "  --container-*: initial;",
    "",
    "  /* Breakpoints must be literal values: media queries cannot read variables. */",
    `  --breakpoint-md: ${scalar(tokens, "layout", "breakpoint-md")};`,
    `  --breakpoint-lg: ${scalar(tokens, "layout", "breakpoint-lg")};`,
    "",
    "  /* The 4 px base: p-1 = space-1, p-6 = space-6, … */",
    `  --spacing: ${scalar(tokens, "spacing", "space-1")};`,
    "}",
    "",
    "@theme inline {",
    "  /* Semantic colours: bg-surface, text-ink-muted, border-line, … */",
    ...colors,
    "",
    "  /* Fonts: font-display, font-sans, font-deva */",
    "  --font-display: var(--font-display);",
    "  --font-sans: var(--font-sans);",
    "  --font-deva: var(--font-deva);",
    "",
    "  /* Radii: rounded-md, rounded-lg, … */",
    ...radii,
    "",
    "  /* Layout: max-w-content, max-w-reading, w-sidebar, h-topbar */",
    "  --container-content: var(--container-max);",
    "  --container-reading: var(--reading-max);",
    "  --spacing-sidebar: var(--sidebar-width);",
    "  --spacing-topbar: var(--topbar-height);",
    "}",
    "",
    ...tokens.shadow.tokens.map((t) => shadowUtility(t.name)),
    "",
  ];
  return lines.join("\n");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const css = buildTailwindTheme(designTokens);
  if (process.argv.includes("--check")) {
    const current = readFileSync(themeCssPath, "utf8");
    if (current !== css) {
      console.error(
        `${path.relative(repoRoot, themeCssPath)} is out of date. Run \`pnpm tokens\`.`,
      );
      process.exit(1);
    }
    console.log("Tailwind theme is up to date.");
  } else {
    writeFileSync(themeCssPath, css);
    console.log(`Wrote ${path.relative(repoRoot, themeCssPath)}`);
  }
}
