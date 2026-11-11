// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PromptComposer } from "./prompt-composer";

describe("PromptComposer", () => {
  it("has the prompt, the six video types, the format and the generate button", () => {
    render(<PromptComposer />);
    expect(screen.getByLabelText("Describe your video")).toBeInTheDocument();
    const types = screen.getByRole("group", { name: "Video type" });
    expect(types.querySelectorAll("button")).toHaveLength(6);
    expect(screen.getByRole("button", { name: "Explainer" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("radiogroup", { name: "Format" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generate video" })).toHaveAttribute(
      "type",
      "submit",
    );
  });

  it("keeps exactly one video type selected", async () => {
    const onTypeChange = vi.fn();
    render(<PromptComposer onTypeChange={onTypeChange} />);
    await userEvent.click(screen.getByRole("button", { name: "Travel" }));
    expect(screen.getByRole("button", { name: "Travel" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Explainer" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(onTypeChange).toHaveBeenCalledWith("Travel");
  });

  it("generates on submit, and shows progress while loading", async () => {
    const onGenerate = vi.fn();
    const { rerender } = render(<PromptComposer onGenerate={onGenerate} />);
    await userEvent.type(screen.getByLabelText("Describe your video"), "How UPI works");
    await userEvent.click(screen.getByRole("button", { name: "Generate video" }));
    expect(onGenerate).toHaveBeenCalledOnce();
    rerender(<PromptComposer onGenerate={onGenerate} loading />);
    expect(screen.getByRole("button", { name: "Generating…" })).toHaveAttribute(
      "aria-busy",
      "true",
    );
  });
});
