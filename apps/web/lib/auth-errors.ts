// Turns a Better Auth error into what the form shows: a message, and the field it belongs to.
import { passwordRules } from "./auth-rules";

export type AuthErrorInput =
  { code?: string; message?: string; status?: number } | null | undefined;
export type FormError = { field?: "name" | "email" | "password"; message: string };

export const duplicateEmailMessage =
  "An account with this email already exists. Sign in instead, or reset your password.";

export type AuthFields = { name: string; email: string; password: string };

/**
 * Checks every field before anything is sent, so all problems show at once. Sign-in only
 * needs something in each field; the server says whether they match.
 */
export function validateAuthFields(
  mode: "sign-in" | "sign-up",
  values: AuthFields,
): Partial<Record<keyof AuthFields, string>> {
  const errors: Partial<Record<keyof AuthFields, string>> = {};
  if (mode === "sign-up" && !values.name.trim()) errors.name = "Enter your name.";
  if (!values.email.trim()) errors.email = "Enter your email address.";
  if (mode === "sign-up" && values.password.length < passwordRules.min) {
    errors.password = `Use at least ${passwordRules.min} characters.`;
  } else if (!values.password) {
    errors.password = "Enter your password.";
  }
  return errors;
}

export function toFormError(error: AuthErrorInput): FormError {
  if (error?.status === 429) {
    return { message: "Too many attempts. Wait a minute, then try again." };
  }
  switch (error?.code) {
    case "INVALID_EMAIL_OR_PASSWORD":
      return {
        message: "That email and password don't match. Check them, or reset your password.",
      };
    case "USER_ALREADY_EXISTS":
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
      return { field: "email", message: duplicateEmailMessage };
    case "INVALID_EMAIL":
      return { field: "email", message: "Enter an email address like you@example.com." };
    case "PASSWORD_TOO_SHORT":
      return { field: "password", message: `Use at least ${passwordRules.min} characters.` };
    case "PASSWORD_TOO_LONG":
      return { field: "password", message: `Use at most ${passwordRules.max} characters.` };
    case "PASSWORD_COMPROMISED":
      return {
        field: "password",
        message: "This password has appeared in a data breach. Choose a different one.",
      };
    case "INVALID_TOKEN":
    case "TOKEN_EXPIRED":
      return { message: "This link has expired or was already used. Ask for a new one." };
  }
  // A message we wrote ourselves on the server (e.g. an account being deleted) is safe to show.
  if (error?.status === 403 && error.message) return { message: error.message };
  return { message: "Something went wrong. Try again in a moment." };
}
