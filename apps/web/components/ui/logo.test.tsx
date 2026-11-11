// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { findColorLiterals } from "@vidcosmos/config/check-no-hex";
import { Logo } from "./logo";

describe("Logo", () => {
  it("is an image named Vidcosmos", () => {
    render(<Logo />);
    expect(screen.getByRole("img", { name: "Vidcosmos" })).toBeInTheDocument();
  });

  it("can be hidden when visible text already names it", () => {
    const { container } = render(<Logo title="" />);
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("sizes the full logo by height and keeps the mark square", () => {
    const { container, rerender } = render(<Logo size={44} />);
    expect(container.querySelector("svg")).toHaveAttribute("width", "262");
    rerender(<Logo variant="mark" size={20} />);
    expect(container.querySelector("svg")).toHaveAttribute("width", "20");
    expect(container.querySelectorAll("path")).toHaveLength(1);
  });

  it("follows the theme through semantic tokens, with no colour literals", () => {
    const { container } = render(<Logo />);
    expect(container.querySelector("circle")).toHaveClass("fill-brand");
    expect(container.querySelector("ellipse")).toHaveClass("stroke-highlight");
    expect(findColorLiterals(container.innerHTML)).toEqual([]);
  });

  it("gives each instance its own valid clip-path id", () => {
    const { container } = render(
      <>
        <Logo />
        <Logo variant="mark" />
      </>,
    );
    const ids = [...container.querySelectorAll("clipPath")].map((clip) => clip.id);
    expect(new Set(ids).size).toBe(2);
    for (const id of ids) expect(id).toMatch(/^[a-zA-Z0-9_-]+$/);
  });
});
