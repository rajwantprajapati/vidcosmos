// F18, F19: the parts of the video that don't need a browser: themes from the design tokens, the
// safe areas, icons, caption lines, text fitting, the layout check's rule, the cycle's layout,
// chart numbers and colours, the icon grid, and the still cases themselves. The rendered stills
// are checked by `pnpm video:stills`.
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  iconNames,
  limits,
  specIssues,
  type SpokenWord,
  type TemplateName,
  templateNames,
} from "@vidcosmos/spec/video";
import { describe, expect, it } from "vitest";
import { captionLimits, captionPages } from "./captions";
import { fitBox, fitFontSize, fontFiles, linesFor, longestWordEm, textEm } from "./fonts";
import { stageOf, videoFormats } from "./format";
import { layoutProblem } from "./layout-check";
import { countingText, countsUp, formatNumber, formatValue, percentages } from "./numbers";
import { lucideIcon } from "./parts";
import { stillLengths, stillScene, stillSpec, stillTemplates } from "./remotion/cases";
import { cycleGeometry } from "./templates/flowchart";
import { gridColumns } from "./templates/icon-grid";
import { largestSlice, sliceColours } from "./templates/pie-chart";
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

describe("numbers on screen", () => {
  it("writes chart values in lakh and crore, in English and Hindi", () => {
    expect(formatNumber(7, "en")).toBe("7");
    expect(formatNumber(3.75, "en")).toBe("3.75");
    expect(formatNumber(98_765, "en")).toBe("98,765");
    expect(formatNumber(120_000, "en")).toBe("1.2 lakh");
    expect(formatNumber(45_600_000, "en")).toBe("4.6 crore");
    expect(formatNumber(987_654_321_000, "en")).toBe("98,765 crore");
    expect(formatNumber(1e12, "en")).toBe("1 lakh crore");
    expect(formatNumber(4_500_000, "hi")).toBe("45 लाख");
    expect(formatNumber(1_200_000_000, "hi")).toBe("120 करोड़");
  });

  it("puts a unit where it's read", () => {
    expect(formatValue(72, "en", "%")).toBe("72%");
    expect(formatValue(120_000, "en", "₹")).toBe("₹1.2 lakh");
    expect(formatValue(30, "en", "users")).toBe("30 users");
    expect(formatValue(30, "en")).toBe("30");
  });

  it("rounds a pie's shares to whole percentages that add up to 100", () => {
    expect(percentages([1, 1, 1])).toEqual([34, 33, 33]);
    expect(percentages([1, 2])).toEqual([33, 67]);
    expect(percentages([5, 0])).toEqual([100, 0]);
    for (const values of [
      [34, 26, 18, 13, 9],
      [1, 1, 1, 1, 1, 1, 1],
      [0.1, 0.2, 99.7],
    ]) {
      expect(percentages(values).reduce((a, b) => a + b, 0)).toBe(100);
    }
  });

  it("counts a stat up to its own text, keeping symbols, decimals and grouping", () => {
    expect(countingText("72%", 0)).toBe("0%");
    expect(countingText("72%", 0.5)).toBe("36%");
    expect(countingText("72%", 1)).toBe("72%");
    expect(countingText("₹1,20,000", 0.5)).toBe("₹60,000");
    expect(countingText("1,200,000 users", 0.5)).toBe("600,000 users");
    expect(countingText("4.5", 0.5)).toBe("2.3");
    expect(countingText("₹1.2 लाख", 0.5)).toBe("₹0.6 लाख");
    expect(countingText("10 crore users", 0.5)).toBe("5 crore users");
    expect(countingText("Rs 500", 0.5)).toBe("Rs 250");
    expect(countingText("+35%", 0.5)).toBe("+18%");
    expect(countingText("No.", 0.5)).toBe("No.");
  });

  it("leaves a stat that isn't an amount as it is (QA)", () => {
    for (const value of [
      "1947",
      "2024",
      "1947 AD",
      "2024 elections",
      "5G",
      "COVID-19",
      "24x7",
      "#1",
      "1 in 3",
      "4.5x",
    ]) {
      expect(countsUp(value), value).toBe(false);
      expect(countingText(value, 0.5), value).toBe(value);
    }
    for (const value of [
      "72%",
      "+35%",
      "−2%",
      "₹1,20,000",
      "3,000",
      "250",
      "2500",
      "10K+",
      "1.2 lakh",
      "1200 crore",
    ]) {
      expect(countsUp(value), value).toBe(true);
    }
  });

  it("picks the scale from the rounded value (QA)", () => {
    expect(formatNumber(99_999.6, "en")).toBe("1 lakh");
    expect(formatNumber(9_996_000, "en")).toBe("1 crore");
    expect(formatNumber(9_999_999, "en")).toBe("1 crore");
    expect(formatNumber(999_999_000_000, "en")).toBe("1 lakh crore");
    expect(formatNumber(99_999, "en")).toBe("99,999");
  });

  it("doesn't scale a number whose unit already says its scale (QA)", () => {
    expect(formatValue(5e11, "en", "₹ crore")).toBe("₹5,00,00,00,00,000 crore");
    expect(formatValue(4500, "en", "₹ crore")).toBe("₹4,500 crore");
    expect(formatValue(12, "en", "lakh users")).toBe("12 lakh users");
    expect(formatValue(3, "hi", "करोड़")).toBe("3 करोड़");
  });

  it("writes Rs, INR and US$ before the number (QA)", () => {
    expect(formatValue(1234, "en", "Rs")).toBe("Rs 1,234");
    expect(formatValue(1234, "en", "Rs.")).toBe("Rs. 1,234");
    expect(formatValue(1234, "en", "INR")).toBe("INR 1,234");
    expect(formatValue(5, "en", "US$")).toBe("US$5");
  });
});

describe("chart and grid layouts", () => {
  it("settles a pie on its largest slice", () => {
    expect(largestSlice([97, 1, 1, 0.6, 0.4])).toBe(0);
    expect(largestSlice([9, 34, 34])).toBe(1);
  });

  it("gives every pie slice its own colour in every palette", () => {
    for (const palette of palettes) {
      const colours = sliceColours(videoTheme(palette));
      expect(new Set(colours).size, palette).toBe(limits.pieChart.max);
    }
  });

  it("lays icon grids out two a row in 9:16 and wider in 16:9 and 1:1", () => {
    expect([4, 5, 6].map((n) => gridColumns(n, "9:16"))).toEqual([2, 2, 2]);
    expect([4, 5, 6].map((n) => gridColumns(n, "16:9"))).toEqual([4, 3, 3]);
    expect([4, 5, 6].map((n) => gridColumns(n, "1:1"))).toEqual([2, 3, 3]);
  });
});

describe("the still cases", () => {
  it("cover every template", () => {
    const covered = new Set(
      stillTemplates.map((t) => stillScene(t, "en", "short").template as TemplateName),
    );
    expect([...covered].sort()).toEqual([...templateNames].sort());
  });

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
