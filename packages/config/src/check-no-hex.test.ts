import { describe, expect, it } from "vitest";
import { findColorLiterals, scanRepository } from "./check-no-hex.ts";

describe("findColorLiterals", () => {
  it.each([
    ["color: #fff;", "#fff"],
    ['fill="#14B8A6"', "#14B8A6"],
    ["background: #0e1f2b80;", "#0e1f2b80"],
    ["box-shadow: 0 0 0 1px rgba(0,0,0,0.1);", "rgba("],
    ["color: hsl(10 20% 30%);", "hsl("],
    ['className="bg-[#ff6f59]"', "#ff6f59"],
  ])("finds the colour in %s", (line, text) => {
    expect(findColorLiterals(line)).toEqual([{ file: "<source>", line: 1, text }]);
  });

  it.each([
    'clipPath="url(#vc-front)"',
    "background: var(--surface);",
    "const total = items.length; // #1234567 is a ticket, not a colour",
    "&#123; is an HTML entity",
    'fill="#fff" // allow-color-literal: exported to a format without variables',
  ])("ignores %s", (line) => {
    expect(findColorLiterals(line)).toEqual([]);
  });

  it("reports the line number", () => {
    expect(findColorLiterals("a\nb\ncolor: #abc;", "x.css")).toEqual([
      { file: "x.css", line: 3, text: "#abc" },
    ]);
  });
});

describe("the repository", () => {
  it("has no colour literals in apps/ or packages/", () => {
    expect(scanRepository()).toEqual([]);
  });
});
