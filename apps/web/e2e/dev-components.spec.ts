import { readFileSync } from "node:fs";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

const names = [
  "Button",
  "Icon",
  "TextField",
  "SegmentedControl",
  "Chip",
  "Badge",
  "ProgressBar",
  "Toast",
  "Card",
  "Logo",
  "PromptComposer",
  "VideoCard",
  "SceneRow",
  "ChatMessage",
  "ProposalCard",
  "UsageMeter",
];
const previews = path.resolve(import.meta.dirname, "../../../design/design-system/previews");

test.describe("component gallery", () => {
  test("shows all 16 components in light and dark", async ({ page }) => {
    await page.goto("/dev/components");
    for (const name of names) {
      await expect(page.getByRole("heading", { level: 2, name, exact: true })).toBeVisible();
      await expect(page.getByTestId(`preview-${name}-light`)).toBeVisible();
      await expect(page.getByTestId(`preview-${name}-dark`)).toBeVisible();
    }
  });

  test("has no accessibility violations (axe)", async ({ page }) => {
    await page.goto("/dev/components");
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes.length} × ${v.help}`)).toEqual([]);
  });

  test("shows the focus ring on every interactive part reached by keyboard", async ({ page }) => {
    // Some parts animate their shadow; reduced motion makes the ring appear at once so it can be read.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/dev/components");
    const seen = new Map<string, string>();
    for (let i = 0; i < 150; i++) {
      await page.keyboard.press("Tab");
      const focused = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        const frame = el?.closest("[data-testid^=preview-]");
        if (!el || !frame) return null;
        return {
          key: `${frame.getAttribute("data-testid")} ${el.tagName.toLowerCase()}[${el.getAttribute("role") ?? ""}] ${el.textContent?.trim().slice(0, 30) || el.getAttribute("aria-label") || ""}`,
          shadow: getComputedStyle(el).boxShadow,
        };
      });
      if (focused) seen.set(focused.key, focused.shadow);
    }
    // Buttons, links, inputs, textareas, radios, chips, toast actions, scene rows, cards: all reached.
    expect(seen.size).toBeGreaterThan(60);
    const missing = [...seen].filter(([, shadow]) => !shadow.includes("0px 0px 0px 4px"));
    expect(missing).toEqual([]);
  });

  test("fits a phone screen without sideways scrolling", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "phone layout only");
    await page.goto("/dev/components");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  for (const name of names) {
    for (const theme of ["light", "dark"] as const) {
      test(`${name} (${theme}) matches its design preview`, async ({ page }, testInfo) => {
        test.skip(testInfo.project.name !== "desktop", "previews are 960 px wide");
        await page.goto(`/dev/components?frame=${name}-${theme}`);
        await page.evaluate(() => document.fonts.ready);
        const shot = PNG.sync.read(
          await page.getByTestId(`preview-${name}-${theme}`).screenshot({ animations: "disabled" }),
        );
        const preview = PNG.sync.read(readFileSync(path.join(previews, `${name}_${theme}.png`)));

        // Compare the area both images cover (the previews have empty space below the component).
        const width = Math.min(shot.width, preview.width);
        const height = Math.min(shot.height, preview.height);
        const crop = (image: PNG) => {
          const out = new PNG({ width, height });
          PNG.bitblt(image, out, 0, 0, width, height, 0, 0);
          return out;
        };
        const different = pixelmatch(crop(shot).data, crop(preview).data, null, width, height, {
          threshold: 0.1,
        });
        const share = different / (width * height);
        testInfo.annotations.push({
          type: "pixel difference",
          description: `${(share * 100).toFixed(2)}%`,
        });
        // Icons use Lucide's glyphs, which differ slightly from the preview's hand-drawn ones.
        expect(share).toBeLessThan(name === "Icon" ? 0.015 : 0.006);
      });
    }
  }
});
