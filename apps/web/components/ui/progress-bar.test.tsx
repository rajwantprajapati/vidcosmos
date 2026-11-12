// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProgressBar } from "./progress-bar";

describe("ProgressBar", () => {
  it("is a named progress bar with the value as text", () => {
    render(<ProgressBar value={58} label="Recording narration (4 of 7 scenes)" />);
    const bar = screen.getByRole("progressbar", { name: "Recording narration (4 of 7 scenes)" });
    expect(bar).toHaveAttribute("aria-valuenow", "58");
    expect(screen.getByText("58%")).toBeInTheDocument();
  });

  it("clamps and rounds the value", () => {
    const { rerender } = render(<ProgressBar value={140} />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
    rerender(<ProgressBar value={-3} />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
    rerender(<ProgressBar value={41.6} />);
    expect(screen.getByText("42%")).toBeInTheDocument();
  });

  it("can hide the value text", () => {
    render(<ProgressBar value={10} label="Uploading" showValue={false} />);
    expect(screen.queryByText("10%")).toBeNull();
  });

  it("takes a status tone for the fill", () => {
    const { rerender } = render(<ProgressBar value={70} label="Stopped" tone="danger" />);
    const fill = () => screen.getByRole("progressbar").firstElementChild;
    expect(fill()).toHaveClass("bg-danger");
    rerender(<ProgressBar value={70} label="Stopped" tone="neutral" />);
    expect(fill()).toHaveClass("bg-ink-muted");
    rerender(<ProgressBar value={70} label="Working" />);
    expect(fill()).toHaveClass("bg-brand");
  });

  it("can announce the label, but not the percentage", () => {
    render(<ProgressBar value={40} label="Recording narration" live />);
    expect(screen.getByText("Recording narration")).toHaveAttribute("aria-live", "polite");
    expect(screen.getByText("40%")).not.toHaveAttribute("aria-live");
  });
});
