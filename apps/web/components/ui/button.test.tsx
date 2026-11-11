// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./button";

describe("Button", () => {
  it("renders a primary button that does not submit forms by default", () => {
    render(<Button>Generate video</Button>);
    const button = screen.getByRole("button", { name: "Generate video" });
    expect(button).toHaveAttribute("type", "button");
    expect(button).toHaveClass("bg-brand", "text-on-brand");
  });

  it("uses the requested variant and size", () => {
    render(
      <Button variant="danger" size="sm">
        Delete video
      </Button>,
    );
    expect(screen.getByRole("button")).toHaveClass("bg-danger-fill", "min-h-8");
  });

  it("shows a spinner and aria-busy while loading", () => {
    const { container } = render(<Button loading>Generating…</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("aria-busy", "true");
    expect(container.querySelector("svg.vc-spin")).not.toBeNull();
  });

  it("calls onClick, but not when disabled", async () => {
    const onClick = vi.fn();
    const { rerender } = render(<Button onClick={onClick}>Save version</Button>);
    await userEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
    rerender(
      <Button onClick={onClick} disabled>
        Save version
      </Button>,
    );
    await userEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
