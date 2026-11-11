// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SegmentedControl } from "./segmented-control";

const options = [
  { value: "9:16", label: "9:16" },
  { value: "16:9", label: "16:9" },
  { value: "1:1", label: "1:1" },
];

describe("SegmentedControl", () => {
  it("is a named radio group with the first option selected by default", () => {
    render(<SegmentedControl label="Format" options={options} />);
    expect(screen.getByRole("radiogroup", { name: "Format" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "9:16" })).toBeChecked();
  });

  it("selects on click and reports the value", async () => {
    const onChange = vi.fn();
    render(<SegmentedControl label="Format" options={options} onChange={onChange} />);
    await userEvent.click(screen.getByRole("radio", { name: "1:1" }));
    expect(screen.getByRole("radio", { name: "1:1" })).toBeChecked();
    expect(onChange).toHaveBeenCalledWith("1:1");
  });

  it("moves the choice with the arrow keys", async () => {
    render(<SegmentedControl label="Format" options={options} defaultValue="16:9" />);
    await userEvent.tab();
    expect(screen.getByRole("radio", { name: "16:9" })).toHaveFocus();
    // Radix moves focus on a timer and checks the radio if an arrow key is still down,
    // so hold the key while waiting, as a real key press does.
    await userEvent.keyboard("{ArrowRight>}");
    await waitFor(() => expect(screen.getByRole("radio", { name: "1:1" })).toBeChecked());
    await userEvent.keyboard("{/ArrowRight}");
  });

  it("marks Devanagari options", () => {
    render(
      <SegmentedControl
        label="Language"
        options={[
          { value: "en", label: "English" },
          { value: "hi", label: "हिंदी", lang: "hi" },
        ]}
      />,
    );
    expect(screen.getByRole("radio", { name: "हिंदी" })).toHaveAttribute("lang", "hi");
  });
});
