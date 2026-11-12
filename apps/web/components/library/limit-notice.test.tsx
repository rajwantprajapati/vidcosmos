// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LimitNotice } from "./limit-notice";

describe("LimitNotice", () => {
  it("says the allowance is used up and when it comes back", () => {
    render(<LimitNotice limit={{ max: 20, resetsOn: "1 Dec" }} />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "You’ve used all 20 videos this month. You can make new videos again on 1 Dec. Your videos stay open to edit, export and post.",
    );
  });

  it("with a limit of 0, says new videos are off, with no reset date", () => {
    render(<LimitNotice limit={{ max: 0, resetsOn: "1 Dec" }} />);
    const notice = screen.getByRole("status");
    expect(notice).toHaveTextContent(
      "New videos are turned off for this workspace. Your videos stay open to edit, export and post.",
    );
    expect(notice).not.toHaveTextContent("used all 0");
    expect(notice).not.toHaveTextContent("1 Dec");
  });
});
