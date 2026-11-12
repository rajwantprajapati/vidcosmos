// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { VideoCard } from "./video-card";

describe("VideoCard", () => {
  it("shows the title, type, duration and status badge", () => {
    render(
      <VideoCard title="How UPI moves money" type="Explainer" duration="0:58" status="ready" />,
    );
    expect(screen.getAllByText("How UPI moves money")).toHaveLength(2); // thumbnail headline and title
    expect(screen.getByText("Explainer")).toBeInTheDocument();
    expect(screen.getByText("0:58")).toBeInTheDocument(); // on the thumbnail
    expect(screen.getByText("ready")).toHaveClass("text-success");
  });

  it("uses the status label and shows progress while generating", () => {
    const { container } = render(
      <VideoCard
        title="Ladakh trip reel"
        status="generating"
        statusLabel="Generating 64%"
        progress={64}
        theme="ocean"
      />,
    );
    expect(screen.getByText("Generating 64%")).toHaveClass("text-brand-text");
    expect(container.querySelector('[style*="width: 64%"]')).not.toBeNull();
  });

  it("reads its title once: the thumbnail is hidden from assistive tech", () => {
    render(
      <VideoCard
        title="How UPI moves money"
        type="Explainer"
        duration="0:58"
        status="generating"
        statusLabel="Generating 62%"
        progress={62}
        href="/projects/p1"
      />,
    );
    // On screen twice (thumbnail and caption), in the link's name once, with length and status.
    expect(screen.getByRole("link")).toHaveAccessibleName(
      /^How UPI moves money\s*Explainer\s*, 0:58 long,\s*Generating 62%$/,
    );
  });

  it("is a link to the editor when given an href", () => {
    render(<VideoCard title="Monday motivation" href="/projects/p1" />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/projects/p1");
  });

  it("highlights the spoken word in the caption and follows the aspect ratio", () => {
    const { container } = render(
      <VideoCard
        title="UPI"
        aspect="16:9"
        caption={{ before: "your bank", word: "asks", after: "NPCI" }}
      />,
    );
    expect(container.querySelector("mark")).toHaveTextContent("asks");
    expect(
      (container.querySelector('[style*="aspect-ratio"]') as HTMLElement).style.aspectRatio,
    ).toBe("16 / 9");
  });
});
