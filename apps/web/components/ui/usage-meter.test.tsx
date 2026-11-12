// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { UsageMeter } from "./usage-meter";

describe("UsageMeter", () => {
  it("shows used of max, when it resets, and a progress bar", () => {
    render(<UsageMeter used={12} max={20} resetsOn="1 Dec" />);
    expect(screen.getByText("Videos this month")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("of 20 · resets 1 Dec")).toBeInTheDocument();
    const bar = screen.getByRole("progressbar", { name: "Videos this month" });
    expect(bar).toHaveAttribute("aria-valuenow", "12");
    expect(bar).toHaveAttribute("aria-valuemax", "20");
  });

  it("turns the bar warning at 80% and above", () => {
    const { container, rerender } = render(<UsageMeter used={15} max={20} />);
    expect(container.querySelector(".bg-warning")).toBeNull();
    rerender(<UsageMeter used={16} max={20} label="Exports today" />);
    expect(container.querySelector(".bg-warning")).not.toBeNull();
  });

  it("keeps the progress value within its range when over the limit", () => {
    render(<UsageMeter used={25} max={20} />);
    expect(screen.getByText(/of 20/)).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "20");
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuemax", "20");
  });
});
