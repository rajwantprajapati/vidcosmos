// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Badge } from "./badge";

describe("Badge", () => {
  it("shows its word with the tone's colours", () => {
    render(<Badge tone="success">Ready</Badge>);
    expect(screen.getByText("Ready")).toHaveClass("bg-success-soft", "text-success");
  });

  it("is neutral by default and not interactive", () => {
    const { container } = render(<Badge>Draft</Badge>);
    expect(container.firstChild).toHaveClass("bg-surface-sunken");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("can carry a decorative icon", () => {
    const { container } = render(
      <Badge tone="danger" icon="alert">
        Failed
      </Badge>,
    );
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });
});
