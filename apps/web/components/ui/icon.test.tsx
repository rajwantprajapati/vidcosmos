// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Icon, iconNames } from "./icon";

describe("Icon", () => {
  it("has all 13 glyphs from the design system", () => {
    expect(iconNames).toHaveLength(13);
  });

  it("is hidden from screen readers unless labelled", () => {
    const { container } = render(<Icon name="check" />);
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("is an image with a name when labelled", () => {
    render(<Icon name="alert" label="Failed" />);
    expect(screen.getByRole("img", { name: "Failed" })).toBeInTheDocument();
  });

  it("draws at the requested size with a 1.75 stroke, and spins the loader", () => {
    const { container } = render(<Icon name="loader" size={16} />);
    const svg = container.querySelector("svg")!;
    expect(svg).toHaveAttribute("width", "16");
    expect(svg).toHaveAttribute("stroke-width", "1.75");
    expect(svg).toHaveClass("vc-spin");
  });
});
