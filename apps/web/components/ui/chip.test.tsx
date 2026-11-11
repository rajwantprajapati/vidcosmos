// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Chip } from "./chip";

describe("Chip", () => {
  it("is a toggle button that reports whether it is selected", () => {
    const { rerender } = render(<Chip>Story</Chip>);
    expect(screen.getByRole("button", { name: "Story" })).toHaveAttribute("aria-pressed", "false");
    rerender(<Chip selected>Story</Chip>);
    expect(screen.getByRole("button", { name: "Story" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button")).toHaveClass("bg-ink", "text-bg");
  });

  it("calls onClick", async () => {
    const onClick = vi.fn();
    render(<Chip onClick={onClick}>Travel</Chip>);
    await userEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
