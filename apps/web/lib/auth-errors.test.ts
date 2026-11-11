import { describe, expect, it } from "vitest";
import { duplicateEmailMessage, toFormError } from "./auth-errors";

describe("toFormError", () => {
  it("puts a duplicate email on the email field with the agreed message", () => {
    expect(toFormError({ code: "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL", status: 422 })).toEqual({
      field: "email",
      message: duplicateEmailMessage,
    });
  });

  it("does not say which of email or password was wrong", () => {
    expect(toFormError({ code: "INVALID_EMAIL_OR_PASSWORD", status: 401 }).field).toBeUndefined();
  });

  it("explains rate limits whatever the code", () => {
    expect(toFormError({ code: "X", status: 429 }).message).toMatch(/Too many attempts/);
  });

  it("puts password rules on the password field", () => {
    expect(toFormError({ code: "PASSWORD_TOO_SHORT" })).toEqual({
      field: "password",
      message: "Use at least 10 characters.",
    });
  });

  it("shows our own 403 messages and hides anything unknown", () => {
    expect(toFormError({ status: 403, message: "This account is being deleted." }).message).toBe(
      "This account is being deleted.",
    );
    expect(toFormError({ status: 500, message: "MongoServerError: E11000 …" }).message).toBe(
      "Something went wrong. Try again in a moment.",
    );
  });
});
