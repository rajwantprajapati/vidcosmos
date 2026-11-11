// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Card } from "./card";

describe("Card", () => {
  it("is a padded surface with a hairline border", () => {
    render(<Card>Voice</Card>);
    expect(screen.getByText("Voice")).toHaveClass("bg-surface", "border-line", "p-6", "rounded-lg");
  });

  it("renders as another element, with small padding", () => {
    render(
      <Card as="section" padding="sm" aria-label="Usage">
        Usage
      </Card>,
    );
    const section = screen.getByRole("region", { name: "Usage" });
    expect(section.tagName).toBe("SECTION");
    expect(section).toHaveClass("p-4");
  });

  it("marks the selected card and lifts interactive cards on hover", () => {
    render(
      <Card interactive selected>
        Angle
      </Card>,
    );
    expect(screen.getByText("Angle")).toHaveClass(
      "bg-brand-soft",
      "border-brand-soft-line",
      "hover:shadow-sm",
    );
  });
});
