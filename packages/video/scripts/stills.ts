// `pnpm video:stills` (F18): renders every still case (each template in English and Hindi, at
// the shortest and longest text) in every format and palette, once all of the scene's elements
// are on screen. It fails when:
// - a text box leaves the safe area or overflows its box (the layout check in the browser, run
//   on every case), or
// - a compared image differs from its approved copy in `stills/approved/` (or has none yet).
//
// Palettes change colours, not layout, so only some images are kept and compared: every case
// in the midnight palette, and the other palettes for each template's long English text.
//
//   pnpm video:stills                 render, check and compare
//   pnpm video:stills --approve       accept the new images as approved
//   pnpm video:stills --only=bullets  just the cases whose name contains "bullets" (or any of a
//                                     comma-separated list)
//   pnpm video:stills --full          full-size PNGs to look at; nothing is compared
//
// Approved images are quarter-size JPEGs, committed so a pull request shows visual changes
// without growing the repository much; renders and diff images go to `stills/out/`
// (git-ignored).
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { openBrowser, renderStill, selectComposition } from "@remotion/renderer";
import { elementTimes, estimatedSceneMs, msToFrame } from "@vidcosmos/spec/video";
import jpeg from "jpeg-js";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import { stillLengths, stillSpec, stillTemplates, type Language } from "../src/remotion/cases.ts";
import { palettes } from "../src/theme.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(here, "..");
const fontsDir = path.resolve(packageRoot, "../../design/design-system/fonts");
const approvedDir = path.join(packageRoot, "stills/approved");
const outDir = path.join(packageRoot, "stills/out");
const diffDir = path.join(outDir, "diff");
const layoutTag = "[vidcosmos-layout]";

/** Rendered at a quarter of full size: enough to see a change, small enough to commit. */
const quarter = 0.25;
const jpegQuality = 80;
/** Pixels whose colour differs by more than this count as changed (pixelmatch). */
const colourThreshold = 0.1;
/** An image may differ in this share of its pixels (anti-aliasing) and still match. */
const allowedChange = 0.001;
/** Generous, so a busy machine slows the run down rather than failing it. */
const timeoutInMilliseconds = 120_000;

const args = process.argv.slice(2);
const approve = args.includes("--approve");
const only = args.find((a) => a.startsWith("--only="))?.slice("--only=".length);
const full = args.includes("--full");

type Case = {
  name: string;
  inputProps: { spec: ReturnType<typeof stillSpec>; checkLayout: true };
  frame: number;
  /** Whether its image is kept in `stills/approved/` and compared. */
  compared: boolean;
};

/** The palette every case is compared in; the others only for the long English text. */
const comparedPalette = "midnight";

const formats = ["9:16", "16:9", "1:1"] as const;
const languages: Language[] = ["en", "hi"];

function cases(): Case[] {
  const all: Case[] = [];
  for (const template of stillTemplates)
    for (const language of languages)
      for (const length of stillLengths(language))
        for (const format of formats)
          for (const palette of palettes) {
            const spec = stillSpec(template, language, length, format, palette);
            const scene = spec.scenes[0]!;
            const sceneEnd = msToFrame(estimatedSceneMs(scene, language, spec.voice.speed));
            const lastAppears = Math.max(...Object.values(elementTimes(scene, language)));
            // Once the last element has settled, and before the scene fades out.
            const frame = Math.min(sceneEnd - 10, msToFrame(lastAppears) + 36);
            const name = `${template}-${language}-${length}-${format.replace(":", "x")}-${palette}`;
            const compared =
              palette === comparedPalette || (language === "en" && length === "long");
            all.push({ name, inputProps: { spec, checkLayout: true }, frame, compared });
          }
  return all;
}

function wantedCases(all: Case[]): Case[] {
  const wanted = only?.split(",").filter(Boolean);
  return wanted ? all.filter((c) => wanted.some((part) => c.name.includes(part))) : all;
}

function compare(name: string): "same" | "new" | { changed: number } {
  const approvedFile = path.join(approvedDir, `${name}.jpg`);
  if (!existsSync(approvedFile)) return "new";
  const current = jpeg.decode(readFileSync(path.join(outDir, `${name}.jpg`)), { useTArray: true });
  const approved = jpeg.decode(readFileSync(approvedFile), { useTArray: true });
  if (current.width !== approved.width || current.height !== approved.height) return { changed: 1 };
  const diff = new PNG({ width: current.width, height: current.height });
  const changed = pixelmatch(
    current.data,
    approved.data,
    diff.data,
    current.width,
    current.height,
    {
      threshold: colourThreshold,
    },
  );
  const share = changed / (current.width * current.height);
  if (share <= allowedChange) return "same";
  writeFileSync(path.join(diffDir, `${name}.png`), PNG.sync.write(diff));
  return { changed: share };
}

async function main() {
  const all = cases();
  const list = wantedCases(all);
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(diffDir, { recursive: true });
  mkdirSync(approvedDir, { recursive: true });

  console.log(`Bundling ${list.length} stills…`);
  const serveUrl = await bundle({
    entryPoint: path.join(packageRoot, "src/remotion/index.ts"),
    publicDir: fontsDir,
  });
  const browser = await openBrowser("chrome");
  const problems: string[] = [];
  const changed: string[] = [];
  const added: string[] = [];
  try {
    for (const [index, still] of list.entries()) {
      const composition = await selectComposition({
        serveUrl,
        id: "Still",
        inputProps: still.inputProps,
        puppeteerInstance: browser,
        timeoutInMilliseconds,
      });
      await renderStill({
        serveUrl,
        composition,
        inputProps: still.inputProps,
        frame: Math.min(still.frame, composition.durationInFrames - 1),
        output: path.join(outDir, `${still.name}.${full ? "png" : "jpg"}`),
        ...(full ? { imageFormat: "png" as const } : { imageFormat: "jpeg" as const, jpegQuality }),
        scale: full ? 1 : quarter,
        puppeteerInstance: browser,
        timeoutInMilliseconds,
        onBrowserLog: ({ text }) => {
          if (text.startsWith(layoutTag))
            problems.push(`${still.name}: ${text.slice(layoutTag.length + 1)}`);
        },
      });
      const result = full || !still.compared ? "same" : compare(still.name);
      if (result === "new") added.push(still.name);
      else if (result !== "same")
        changed.push(`${still.name} (${(result.changed * 100).toFixed(2)}% of pixels)`);
      if ((index + 1) % 20 === 0 || index === list.length - 1)
        console.log(`  ${index + 1}/${list.length}`);
    }
  } finally {
    await browser.close({ silent: true });
  }

  if (approve && !full) {
    const kept = list.filter((c) => c.compared);
    for (const { name } of kept) {
      copyFileSync(path.join(outDir, `${name}.jpg`), path.join(approvedDir, `${name}.jpg`));
    }
    // An approved image no case compares any more (a case removed, or no longer kept).
    const keep = new Set(all.filter((c) => c.compared).map((c) => `${c.name}.jpg`));
    for (const file of readdirSync(approvedDir).filter((f) => !keep.has(f))) {
      rmSync(path.join(approvedDir, file));
    }
    console.log(`Approved ${kept.length} stills in ${path.relative(process.cwd(), approvedDir)}.`);
  }

  for (const problem of problems) console.error(`Layout: ${problem}`);
  if (!approve) {
    for (const name of changed) console.error(`Changed: ${name}, diff in stills/out/diff`);
    for (const name of added) console.error(`New, not approved yet: ${name}`);
  }
  const failed = problems.length > 0 || (!approve && (changed.length > 0 || added.length > 0));
  const comparedCount = list.filter((c) => c.compared).length;
  console.log(
    `${list.length} stills, layout checked: ${problems.length} problems. ${comparedCount} compared: ${approve ? "approved" : `${changed.length} changed, ${added.length} not approved`}. Renders in ${path.relative(process.cwd(), outDir)}.`,
  );
  process.exit(failed ? 1 : 0);
}

await main();
