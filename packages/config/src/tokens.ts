// Typed access to design/design-system/tokens.json, the source of truth for the look.
// tokens.css (imported by the app) is generated from the same file by the design export.
// A static import (no filesystem access), so bundlers include only this one file.
import tokensJson from "../../../design/design-system/tokens.json" with { type: "json" };

export type ThemedValue = { light: string; dark: string };

export type ColorToken = { name: string; value: string | ThemedValue; usage: string };
export type ScalarToken = { name: string; value: string; usage: string };
export type ShadowToken = { name: string; value: ThemedValue; usage: string };

export type DesignTokens = {
  name: string;
  version: number;
  color: { tokens: ColorToken[] };
  type: {
    fonts: { family: string; file: string; weight: string }[];
    families: Record<string, unknown>;
    groups: unknown;
  };
  spacing: { tokens: ScalarToken[] };
  radius: { tokens: ScalarToken[] };
  shadow: { tokens: ShadowToken[] };
  layout: { tokens: ScalarToken[] };
  zIndex: { tokens: ScalarToken[] };
};

export const designTokens = tokensJson as DesignTokens;

/** Semantic colours change per theme ({light, dark}); primitives and video colours are single values. */
export function isSemanticColor(token: ColorToken): token is ColorToken & { value: ThemedValue } {
  return typeof token.value === "object";
}
