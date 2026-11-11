// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ProposalCard } from "./proposal-card";

describe("ProposalCard", () => {
  it("shows the summary, scenes, new narration, length and warnings", () => {
    render(
      <ProposalCard
        summary="I'll cut the intro to one sentence."
        scenes="Scenes 1, 3"
        regeneratesVoice
        duration="52 s"
        warnings={["Video will be 94 s, above your 90 s target"]}
      />,
    );
    for (const text of [
      "I'll cut the intro to one sentence.",
      "Scenes 1, 3",
      "New narration",
      "52 s",
    ]) {
      expect(screen.getByText(text)).toBeInTheDocument();
    }
    expect(screen.getByText("Video will be 94 s, above your 90 s target")).toHaveClass(
      "text-warning",
    );
  });

  it("applies or dismisses while proposed", async () => {
    const onApply = vi.fn();
    const onDismiss = vi.fn();
    render(<ProposalCard summary="Switch to ocean." onApply={onApply} onDismiss={onDismiss} />);
    await userEvent.click(screen.getByRole("button", { name: "Apply" }));
    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(onApply).toHaveBeenCalledOnce();
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("keeps its outcome after the user acts", () => {
    const { rerender } = render(<ProposalCard summary="S" status="applied" version={5} />);
    expect(screen.getByText("Applied as version 5")).toHaveClass("text-success");
    expect(screen.queryByRole("button")).toBeNull();
    rerender(<ProposalCard summary="S" status="stale" />);
    expect(
      screen.getByText("The video changed since this was suggested. Ask again."),
    ).toBeInTheDocument();
    rerender(<ProposalCard summary="S" status="dismissed" />);
    expect(screen.getByText("Dismissed")).toBeInTheDocument();
  });
});
