// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { duplicateEmailMessage } from "@/lib/auth-errors";

const router = { replace: vi.fn(), refresh: vi.fn(), push: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const signUpEmail = vi.fn();
const signInEmail = vi.fn();
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    signUp: { email: (...args: unknown[]) => signUpEmail(...args) },
    signIn: { email: (...args: unknown[]) => signInEmail(...args), social: vi.fn() },
  },
}));

const { AuthForm } = await import("./auth-form");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AuthForm field errors", () => {
  it("an empty sign-up shows all three errors and focuses the name", async () => {
    render(<AuthForm mode="sign-up" next="/library" />);
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));

    const name = screen.getByLabelText("Your name");
    const email = screen.getByLabelText("Email");
    const password = screen.getByLabelText("Password");
    for (const field of [name, email, password]) {
      expect(field).toHaveAttribute("aria-invalid", "true");
    }
    expect(name).toHaveAccessibleDescription("Enter your name.");
    expect(email).toHaveAccessibleDescription("Enter your email address.");
    expect(password).toHaveAccessibleDescription("Use at least 10 characters.");
    await waitFor(() => expect(name).toHaveFocus());
    expect(signUpEmail).not.toHaveBeenCalled();
  });

  it("focuses the first invalid field when earlier ones are fine", async () => {
    render(<AuthForm mode="sign-up" next="/library" />);
    await userEvent.type(screen.getByLabelText("Your name"), "Asha");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(screen.getByLabelText("Your name")).not.toHaveAttribute("aria-invalid");
    await waitFor(() => expect(screen.getByLabelText("Email")).toHaveFocus());
    expect(screen.getByLabelText("Password")).toHaveAttribute("aria-invalid", "true");
  });

  it("an empty sign-in asks for email and password together", async () => {
    render(<AuthForm mode="sign-in" next="/library" />);
    await userEvent.click(screen.getByRole("button", { name: /^Sign in$/ }));

    expect(screen.getByLabelText("Email")).toHaveAccessibleDescription("Enter your email address.");
    expect(screen.getByLabelText("Password")).toHaveAccessibleDescription("Enter your password.");
    await waitFor(() => expect(screen.getByLabelText("Email")).toHaveFocus());
  });

  it("a duplicate email from the server lands on the email field and takes focus", async () => {
    signUpEmail.mockResolvedValue({
      error: { code: "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL", status: 422 },
    });
    render(<AuthForm mode="sign-up" next="/library" />);
    await userEvent.type(screen.getByLabelText("Your name"), "Asha");
    await userEvent.type(screen.getByLabelText("Email"), "asha@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "correct-horse-battery");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));

    const email = screen.getByLabelText("Email");
    await waitFor(() => expect(email).toHaveFocus());
    expect(email).toHaveAttribute("aria-invalid", "true");
    expect(email).toHaveAccessibleDescription(duplicateEmailMessage);
  });

  it("a wrong password is a form message in a live region, and focus stays put", async () => {
    signInEmail.mockResolvedValue({ error: { code: "INVALID_EMAIL_OR_PASSWORD", status: 401 } });
    render(<AuthForm mode="sign-in" next="/library" />);
    await userEvent.type(screen.getByLabelText("Email"), "asha@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "not-the-password");
    const submit = screen.getByRole("button", { name: /^Sign in$/ });
    await userEvent.click(submit);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "That email and password don't match",
    );
    expect(screen.getByLabelText("Email")).not.toHaveAttribute("aria-invalid");
    expect(screen.getByLabelText("Email")).not.toHaveFocus();
  });
});
