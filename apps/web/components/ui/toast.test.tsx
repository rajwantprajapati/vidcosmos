// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Toast } from "./toast";

describe("Toast", () => {
  it("announces its message as a status", () => {
    render(<Toast>Version 4 saved</Toast>);
    expect(screen.getByRole("status")).toHaveTextContent("Version 4 saved");
  });

  it("offers one action and a labelled close button", async () => {
    const onAction = vi.fn();
    const onClose = vi.fn();
    render(
      <Toast actionLabel="Undo" onAction={onAction} onClose={onClose}>
        Version 4 saved
      </Toast>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(onAction).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("shows an icon for success and danger", () => {
    const { container, rerender } = render(<Toast>Saved</Toast>);
    expect(container.querySelector("svg")).toBeNull();
    rerender(<Toast tone="danger">Couldn’t reach Instagram.</Toast>);
    expect(container.querySelector("svg")).not.toBeNull();
  });
});
