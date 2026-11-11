// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TextField } from "./text-field";

describe("TextField", () => {
  it("labels the input and links the helper text", () => {
    render(<TextField label="Topic" helper="3 to 500 characters." />);
    const input = screen.getByLabelText("Topic");
    expect(input.tagName).toBe("INPUT");
    expect(input).toHaveAccessibleDescription("3 to 500 characters.");
    expect(input).not.toHaveAttribute("aria-invalid");
  });

  it("shows the error instead of the helper and marks the field invalid", () => {
    render(<TextField label="Caption" helper="Helper" error="Add at least 3 characters." />);
    const input = screen.getByLabelText("Caption");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Add at least 3 characters.");
    expect(input).toHaveClass("border-danger");
    expect(screen.queryByText("Helper")).toBeNull();
  });

  it("renders a resizable textarea when multiline, and passes lang through", () => {
    render(<TextField label="Notes" multiline rows={5} lang="hi" />);
    const textarea = screen.getByLabelText("Notes");
    expect(textarea.tagName).toBe("TEXTAREA");
    expect(textarea).toHaveAttribute("rows", "5");
    expect(textarea).toHaveAttribute("lang", "hi");
  });
});
