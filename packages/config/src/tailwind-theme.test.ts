import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildTailwindTheme, themeCssPath } from "./tailwind-theme.ts";
import { designTokens as tokens, isSemanticColor } from "./tokens.ts";

const css = buildTailwindTheme(tokens);

describe("Tailwind theme from tokens.json", () => {
  it("is up to date (run `pnpm tokens` after changing tokens.json)", () => {
    expect(readFileSync(themeCssPath, "utf8")).toBe(css);
  });

  it("maps every semantic colour to its CSS variable", () => {
    const semantic = tokens.color.tokens.filter(isSemanticColor);
    expect(semantic.length).toBeGreaterThan(30);
    for (const token of semantic) {
      expect(css).toContain(`--color-${token.name}: var(--${token.name});`);
    }
  });

  it("does not expose primitives or video colours to the app", () => {
    for (const token of tokens.color.tokens.filter((t) => !isSemanticColor(t))) {
      expect(css).not.toContain(`--color-${token.name}:`);
    }
  });

  it("removes Tailwind's default palette and uses the design breakpoints", () => {
    expect(css).toContain("--color-*: initial;");
    expect(css).toContain("--breakpoint-md: 768px;");
    expect(css).toContain("--breakpoint-lg: 1200px;");
    expect(css).toContain("--spacing: 4px;");
  });

  it("makes every radius and shadow token available", () => {
    for (const token of tokens.radius.tokens) expect(css).toContain(`var(--${token.name});`);
    for (const token of tokens.shadow.tokens) {
      expect(css).toContain(`@utility ${token.name} {\n  box-shadow: var(--${token.name});\n}`);
    }
  });
});
