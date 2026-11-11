// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));

const resetPassword = vi.fn();
const requestPasswordReset = vi.fn();
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    resetPassword: (...args: unknown[]) => resetPassword(...args),
    requestPasswordReset: (...args: unknown[]) => requestPasswordReset(...args),
  },
}));

const { NewPasswordForm, RequestResetForm } = await import("./reset-password-form");

beforeEach(() => vi.clearAllMocks());

describe("RequestResetForm", () => {
  it("an empty email is a field error and takes focus", async () => {
    render(<RequestResetForm />);
    await userEvent.click(screen.getByRole("button", { name: "Send reset link" }));
    const email = screen.getByLabelText("Email");
    expect(email).toHaveAccessibleDescription("Enter your email address.");
    await waitFor(() => expect(email).toHaveFocus());
    expect(requestPasswordReset).not.toHaveBeenCalled();
  });
});

describe("NewPasswordForm", () => {
  it("a short password is a field error and takes focus", async () => {
    render(<NewPasswordForm token="t" />);
    await userEvent.type(screen.getByLabelText("New password"), "short");
    await userEvent.click(screen.getByRole("button", { name: "Save new password" }));
    const password = screen.getByLabelText("New password");
    expect(password).toHaveAttribute("aria-invalid", "true");
    expect(password).toHaveAccessibleDescription("Use at least 10 characters.");
    await waitFor(() => expect(password).toHaveFocus());
  });

  it("an expired link is a form message, not a password error", async () => {
    resetPassword.mockResolvedValue({ error: { code: "INVALID_TOKEN", status: 400 } });
    render(<NewPasswordForm token="t" />);
    await userEvent.type(screen.getByLabelText("New password"), "a-long-enough-one");
    await userEvent.click(screen.getByRole("button", { name: "Save new password" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("This link has expired");
    expect(screen.getByRole("link", { name: "Ask for a new link" })).toHaveAttribute(
      "href",
      "/reset-password",
    );
    expect(screen.getByLabelText("New password")).not.toHaveAttribute("aria-invalid");
  });
});
