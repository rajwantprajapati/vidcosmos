import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { findColorLiterals } from "@vidcosmos/config/check-no-hex";
import { LogoFull, LogoMark } from "./logo";

describe("logo components", () => {
  it("name themselves Vidcosmos for screen readers", () => {
    expect(renderToStaticMarkup(<LogoMark />)).toContain('aria-label="Vidcosmos"');
    expect(renderToStaticMarkup(<LogoFull />)).toContain('role="img"');
  });

  it("can be hidden from screen readers when a label is already visible", () => {
    const html = renderToStaticMarkup(<LogoMark title="" />);
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain("aria-label");
  });

  it("use the brand tokens, not colour literals", () => {
    const html = renderToStaticMarkup(<LogoFull />);
    expect(findColorLiterals(html)).toEqual([]);
    expect(html).toContain("var(--teal-500)");
    expect(html).toContain("var(--coral-500)");
  });

  it("switch the wordmark colour for the reversed logo", () => {
    expect(renderToStaticMarkup(<LogoFull />)).not.toContain("var(--night-50)");
    expect(renderToStaticMarkup(<LogoFull reversed />)).toContain("var(--night-50)");
  });

  it("give every instance its own valid clip-path id", () => {
    const html = renderToStaticMarkup(
      <>
        <LogoMark />
        <LogoMark />
      </>,
    );
    const ids = [...html.matchAll(/<clipPath id="([^"]+)"/g)].map((m) => m[1]);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
    for (const id of ids) expect(id).toMatch(/^[a-zA-Z0-9_-]+$/);
  });
});
