// F18: the parts of the video that don't need a browser: themes from the design tokens, the
// safe areas, icons, caption lines, text fitting, the layout check's rule, the cycle's layout,
// and the still cases themselves. The rendered stills are checked by `pnpm video:stills`.
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { iconNames, specIssues, type SpokenWord } from "@vidcosmos/spec/video";
import { describe, expect, it } from "vitest";
import { captionLimits, captionPages } from "./captions";
import { fitBox, fitFontSize, fontFiles, linesFor, longestWordEm, textEm } from "./fonts";
import { stageOf, videoFormats } from "./format";
import { layoutProblem } from "./layout-check";
import { lucideIcon } from "./parts";
import { stillLengths, stillScene, stillSpec, stillTemplates } from "./remotion/cases";
import { cycleGeometry } from "./templates/flowchart";
import { palettes, videoTheme } from "./theme";

const here = path.dirname(fileURLToPath(import.meta.url));

describe("video themes", () => {
  it("take each palette's five colours from the design tokens", () => {
    expect(videoTheme("midnight")).toMatchObject({
      bg: "#0B1430", // allow-color-literal: the token's value, checked
      accent: "#5F7DFF", // allow-color-literal: the token's value, checked
      highlight: "#FFD338", // allow-color-literal: the token's value, checked
      light: false,
    });
    for (const palette of palettes) {
      const theme = videoTheme(palette);
      for (const value of Object.values(theme)) {
        if (typeof value === "string") expect(value, palette).not.toBe("");
      }
    }
  });

  it("puts dark text on the highlight and on paper's accent", () => {
    const paper = videoTheme("paper");
    expect(paper.light).toBe(true);
    expect(paper.onHighlight).toBe(paper.text);
    expect(paper.onAccent).toBe(paper.panel);
    expect(videoTheme("ocean").onHighlight).toBe(videoTheme("ocean").bg);
  });
});

describe("formats", () => {
  it("keeps DB §6's safe areas clear", () => {
    expect(stageOf("9:16")).toMatchObject({
      width: 1080,
      height: 1920,
      safe: { left: 65, top: 269, width: 950, height: 1267 },
      orientation: "portrait",
    });
    expect(stageOf("16:9").safe).toEqual({ left: 96, top: 54, width: 1728, height: 972 });
    expect(stageOf("1:1").safe).toEqual({ left: 54, top: 54, width: 972, height: 972 });
  });

  it("splits the safe area into the scene's box and the captions' band below it", () => {
    for (const format of videoFormats) {
      const { safe, content, captions } = stageOf(format);
      expect(content.top).toBe(safe.top);
      expect(content.height + captions.height).toBe(safe.height);
      expect(captions.top).toBe(content.top + content.height);
    }
  });
});

describe("icons and fonts", () => {
  it("every icon name in the closed list is a Lucide icon", () => {
    const missing = iconNames.filter((name) => !lucideIcon(name));
    expect(missing).toEqual([]);
  });

  it("every font file is in the design system", () => {
    for (const { file } of fontFiles) {
      expect(
        existsSync(path.resolve(here, "../../../design/design-system/fonts", file)),
        file,
      ).toBe(true);
    }
  });

  it("shrinks long text to fit, never below the minimum", () => {
    expect(fitFontSize("Short", 100, 20, 60)).toBe(100);
    expect(fitFontSize("x".repeat(80), 100, 20, 60)).toBe(60);
    expect(linesFor("x".repeat(100), 20, 600)).toBe(2);
    const size = fitBox("x".repeat(100), 60, 20, 500, 100, 1.2);
    expect(linesFor("x".repeat(100), size, 500) * size * 1.2).toBeLessThanOrEqual(100);
    expect(fitBox("x".repeat(1000), 60, 20, 100, 10, 1.2)).toBe(20);
  });
});

describe("estimating text width", () => {
  it("counts capitals and wide letters as wider than lower case", () => {
    expect(textEm("AUTHENTICATION")).toBeGreaterThan(textEm("authentication") * 1.2);
    expect(textEm("MW")).toBeGreaterThan(textEm("ab"));
  });

  it("wraps between words, and keeps the longest word whole when sizing", () => {
    // Two words that each fill most of a line can't share one.
    expect(linesFor("Telecommunications Electromagnetism", 40, 500)).toBe(2);
    const size = fitBox("Internationalisation", 60, 18, 300, 400, 1.2);
    expect(longestWordEm("Internationalisation") * size).toBeLessThanOrEqual(300);
  });

  it("prefers two lines when a smaller size allows it", () => {
    const text = "YOUR EMPLOYER DEDUCTS TDS BEFORE SALARY HITS YOUR ACCOUNT";
    const twoLines = fitBox(text, 52, 24, 800, 200, 1.2, 2);
    expect(linesFor(text, twoLines, 800)).toBeLessThanOrEqual(2);
    expect(twoLines).toBeLessThan(fitBox(text, 52, 24, 800, 200, 1.2));
  });
});

describe("captions", () => {
  const words = (text: string): SpokenWord[] =>
    text.split(" ").map((word, i) => ({ text: word, startMs: i * 400, endMs: i * 400 + 350 }));

  it("shows at most two lines of 32 characters at a time", () => {
    const pages = captionPages(
      words(
        "You tap Pay and in about two seconds your friend has the money and it feels instant every time you try it",
      ),
    );
    expect(pages.length).toBeGreaterThan(1);
    for (const page of pages) {
      expect(page.lines.length).toBeLessThanOrEqual(captionLimits.lines);
      for (const line of page.lines) {
        expect(line.map((w) => w.text).join(" ").length).toBeLessThanOrEqual(
          captionLimits.lineChars,
        );
      }
    }
  });

  it("starts a new page after a sentence, in English and Hindi", () => {
    const pages = captionPages(words("Pay now. Then wait। फिर देखो"));
    expect(
      pages.map((p) =>
        p.lines
          .flat()
          .map((w) => w.text)
          .join(" "),
      ),
    ).toEqual(["Pay now.", "Then wait।", "फिर देखो"]);
  });
});

describe("the layout check", () => {
  const safe = { left: 100, top: 100, width: 800, height: 600 };
  it("passes a box inside its area and flags one that leaves it or overflows", () => {
    expect(layoutProblem({ left: 100, top: 100, width: 800, height: 600 }, safe, 0)).toBeNull();
    expect(layoutProblem({ left: 90, top: 100, width: 100, height: 50 }, safe, 0)).toBe(
      "leaves its area (left by 10 px)",
    );
    expect(layoutProblem({ left: 500, top: 650, width: 450, height: 100 }, safe, 0)).toBe(
      "leaves its area (right by 50 px, bottom by 50 px)",
    );
    expect(layoutProblem({ left: 200, top: 200, width: 100, height: 50 }, safe, 12)).toBe(
      "overflows its box by 12 px",
    );
  });
});

describe("the cycle layout", () => {
  it("keeps neighbouring cards apart, inside the box, for 3 to 6 steps in every format", () => {
    for (const format of videoFormats) {
      const box = {
        width: stageOf(format).content.width,
        height: stageOf(format).content.height - 160,
      };
      for (let n = 3; n <= 6; n++) {
        const { w, h, points } = cycleGeometry(n, box);
        points.forEach((p, i) => {
          const q = points[(i + 1) % n]!;
          const apart = Math.abs(p.x - q.x) >= w || Math.abs(p.y - q.y) >= h;
          expect(apart, `${format} ${n} steps, cards ${i} and ${(i + 1) % n}`).toBe(true);
          expect(p.x - w / 2, format).toBeGreaterThanOrEqual(0);
          expect(p.y + h / 2, format).toBeLessThanOrEqual(box.height);
        });
      }
    }
  });
});

describe("the still cases", () => {
  it("are valid scenes whose narration says every trigger, in order", () => {
    for (const template of stillTemplates) {
      for (const language of ["en", "hi"] as const) {
        for (const length of stillLengths(language)) {
          const scene = stillScene(template, language, length);
          const spec = stillSpec(template, language, length, "9:16", "midnight");
          expect(
            specIssues(spec).filter((issue) => issue.sceneId !== null),
            `${template} ${language} ${length}`,
          ).toEqual([]);
          expect(scene.narration.length).toBeLessThanOrEqual(400);
        }
      }
    }
  });
});
