// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ChatMessage } from "./chat-message";

describe("ChatMessage", () => {
  it("puts the user's message on the right on the inverse surface", () => {
    render(<ChatMessage role="user">Make the intro shorter.</ChatMessage>);
    expect(screen.getByText("Make the intro shorter.")).toHaveClass(
      "self-end",
      "bg-surface-inverse",
    );
  });

  it("puts the assistant's message on the left on the sunken surface", () => {
    render(<ChatMessage role="assistant">Sure.</ChatMessage>);
    expect(screen.getByText("Sure.")).toHaveClass("self-start", "bg-surface-sunken");
  });
});
