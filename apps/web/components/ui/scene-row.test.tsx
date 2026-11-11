// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SceneRow } from "./scene-row";

describe("SceneRow", () => {
  it("shows the padded number, title, template and duration", () => {
    render(
      <SceneRow index={2} title="How a payment travels" template="Flowchart" duration="9.8 s" />,
    );
    const row = screen.getByRole("button");
    expect(row).toHaveTextContent("02");
    expect(row).toHaveTextContent("How a payment travels");
    expect(row).toHaveTextContent("Flowchart · 9.8 s");
    expect(row).not.toHaveAttribute("aria-current");
  });

  it("marks the selected scene", () => {
    render(<SceneRow index={1} title="What is UPI?" selected />);
    expect(screen.getByRole("button")).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("button")).toHaveClass("bg-brand-soft");
  });

  it("shows Edited, and No narration when narration failed", () => {
    const { rerender } = render(<SceneRow index={1} title="A" edited />);
    expect(screen.getByText("Edited")).toBeInTheDocument();
    rerender(<SceneRow index={1} title="A" edited failed />);
    expect(screen.getByText("No narration")).toBeInTheDocument();
    expect(screen.queryByText("Edited")).toBeNull();
  });
});
