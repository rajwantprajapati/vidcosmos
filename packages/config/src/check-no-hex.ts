// Fails when a colour literal (hex, rgb(), hsl()) appears in app or package source.
// Colours come from the design tokens (design/design-system/tokens.css), never literals.
//
//   node packages/config/src/check-no-hex.ts      (part of `pnpm lint`)
//
// A line can opt out with the comment `allow-color-literal` and a reason.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { repoRoot } from "./paths.ts";

const scannedRoots = ["apps", "packages"];
const scannedExtensions = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".css",
  ".svg",
  ".html",
]);
const skippedDirectories = new Set([
  "node_modules",
  ".next",
  ".turbo",
  "dist",
  "coverage",
  "playwright-report",
  "test-results",
]);

// A hex colour is #rgb, #rgba, #rrggbb or #rrggbbaa not followed by more word characters.
// `&#123;` (an HTML entity) is not a colour.
const colorPattern =
  /(?<![&\w])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b|\b(?:rgba?|hsla?)\(/g;
const optOut = "allow-color-literal";

export type ColorLiteral = { file: string; line: number; text: string };

export function findColorLiterals(source: string, file = "<source>"): ColorLiteral[] {
  const found: ColorLiteral[] = [];
  source.split("\n").forEach((lineText, index) => {
    if (lineText.includes(optOut)) return;
    for (const match of lineText.matchAll(colorPattern)) {
      found.push({ file, line: index + 1, text: match[0] });
    }
  });
  return found;
}

function* walk(directory: string): Generator<string> {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!skippedDirectories.has(entry.name)) yield* walk(path.join(directory, entry.name));
    } else if (scannedExtensions.has(path.extname(entry.name))) {
      yield path.join(directory, entry.name);
    }
  }
}

export function scanRepository(root = repoRoot): ColorLiteral[] {
  const found: ColorLiteral[] = [];
  for (const scanned of scannedRoots) {
    for (const file of walk(path.join(root, scanned))) {
      // The checker and its tests describe the patterns they look for.
      if (path.basename(file).startsWith("check-no-hex.")) continue;
      found.push(...findColorLiterals(readFileSync(file, "utf8"), path.relative(root, file)));
    }
  }
  return found;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const found = scanRepository();
  if (found.length > 0) {
    console.error(
      "Colour literals found. Use a design token (var(--…) or a Tailwind token class) instead:",
    );
    for (const item of found) console.error(`  ${item.file}:${item.line}  ${item.text}`);
    process.exit(1);
  }
  console.log("No colour literals in apps/ or packages/.");
}
