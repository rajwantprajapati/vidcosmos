"use client";

// Reset password: ask for a link by email, or (with the token from that link) set a new one.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { Button, TextField } from "@/components/ui";
import { authClient } from "@/lib/auth-client";
import { toFormError } from "@/lib/auth-errors";
import { passwordRules } from "@/lib/auth-rules";
import { AuthCard, authLinkClass, FormMessage } from "./auth-card";
import { useFormErrors } from "./use-form-errors";

const requestFieldIds = { email: "rp-email" };
const newPasswordFieldIds = { password: "rp-password" };

export function RequestResetForm({ linkError }: { linkError?: boolean }) {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const errors = useFormErrors(
    requestFieldIds,
    linkError ? "That link has expired or was already used. Ask for a new one." : undefined,
  );
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email") ?? "").trim();
    if (!email) return errors.report({ fields: { email: "Enter your email address." } });
    setBusy(true);
    errors.clear();
    const result = await authClient.requestPasswordReset({ email, redirectTo: "/reset-password" });
    setBusy(false);
    if (!result.error) return setSentTo(email);
    const failed = toFormError(result.error);
    errors.report(
      failed.field === "email"
        ? { fields: { email: failed.message } }
        : { message: failed.message },
    );
  }

  if (sentTo) {
    return (
      <AuthCard
        heading="Check your email"
        subheading={
          <>
            If there’s an account for <strong className="font-semibold text-ink">{sentTo}</strong>,
            we sent it a link to choose a new password. The link works for 1 hour.
          </>
        }
      >
        <Link href="/sign-in" className={`${authLinkClass} self-start text-[14px] font-semibold`}>
          Back to sign in
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      heading="Reset your password"
      subheading="Enter the email you signed up with and we'll send you a link."
    >
      <form noValidate onSubmit={submit} className="flex flex-col gap-4">
        <TextField
          id="rp-email"
          name="email"
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          error={errors.fieldError("email")}
        />
        {errors.message ? <FormMessage tone="danger">{errors.message}</FormMessage> : null}
        <Button type="submit" size="lg" fullWidth loading={busy} disabled={busy}>
          {busy ? "Sending…" : "Send reset link"}
        </Button>
      </form>
      <Link href="/sign-in" className={`${authLinkClass} self-start text-[14px] font-semibold`}>
        Back to sign in
      </Link>
    </AuthCard>
  );
}

export function NewPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const errors = useFormErrors(newPasswordFieldIds);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const newPassword = String(new FormData(event.currentTarget).get("password") ?? "");
    if (newPassword.length < passwordRules.min) {
      return errors.report({
        fields: { password: `Use at least ${passwordRules.min} characters.` },
      });
    }
    setBusy(true);
    errors.clear();
    const result = await authClient.resetPassword({ newPassword, token });
    if (result.error) {
      setBusy(false);
      // A password problem belongs to the field; an expired link to the whole form.
      const failed = toFormError(result.error);
      errors.report(
        failed.field === "password"
          ? { fields: { password: failed.message } }
          : { message: failed.message },
      );
      return;
    }
    router.replace("/sign-in?notice=reset");
  }

  return (
    <AuthCard
      heading="Choose a new password"
      subheading="You'll be signed out on every device, then you can sign in with the new one."
    >
      <form noValidate onSubmit={submit} className="flex flex-col gap-4">
        <TextField
          id="rp-password"
          name="password"
          label="New password"
          type="password"
          autoComplete="new-password"
          maxLength={passwordRules.max}
          helper={`At least ${passwordRules.min} characters.`}
          error={errors.fieldError("password")}
        />
        {errors.message ? (
          <FormMessage tone="danger">
            {errors.message}{" "}
            <Link href="/reset-password" className={authLinkClass}>
              Ask for a new link
            </Link>
          </FormMessage>
        ) : null}
        <Button type="submit" size="lg" fullWidth loading={busy} disabled={busy}>
          {busy ? "Saving…" : "Save new password"}
        </Button>
      </form>
    </AuthCard>
  );
}
