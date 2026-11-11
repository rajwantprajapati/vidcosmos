"use client";

// Sign in and Create account (SignIn design). One form; the segmented control switches
// between /sign-in and /sign-up so each has its own address.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { Button, SegmentedControl, TextField } from "@/components/ui";
import { authClient } from "@/lib/auth-client";
import { toFormError, validateAuthFields } from "@/lib/auth-errors";
import { passwordRules } from "@/lib/auth-rules";
import { authLinkClass, AuthCard, FormMessage } from "./auth-card";
import { useFormErrors } from "./use-form-errors";

export type AuthMode = "sign-in" | "sign-up";

const copy = {
  "sign-in": {
    heading: "Welcome back",
    subheading: "Sign in to pick up where you left off.",
    submit: "Sign in",
    busy: "Signing in…",
  },
  "sign-up": {
    heading: "Create your account",
    subheading: "Free while Vidcosmos is in beta. No credit card.",
    submit: "Create account",
    busy: "Creating account…",
  },
} as const;

/** Input ids in screen order: the first invalid one gets focus. */
const fieldIds = { name: "su-name", email: "si-email", password: "si-password" };

const modes = [
  { value: "sign-in", label: "Sign in" },
  { value: "sign-up", label: "Create account" },
];

export function AuthForm({
  mode,
  next,
  notice,
  initialError,
}: {
  mode: AuthMode;
  /** Where to go after signing in (already checked to be an app path). */
  next: string;
  /** A message from the previous step, e.g. after a password reset. */
  notice?: string;
  /** An error from a redirect, e.g. Google sign-in that didn't finish. */
  initialError?: string;
}) {
  const router = useRouter();
  const errors = useFormErrors(fieldIds, initialError);
  const [busy, setBusy] = useState<"email" | "google" | null>(null);
  const text = copy[mode];
  const signUp = mode === "sign-up";
  const query = next === "/library" ? "" : `?next=${encodeURIComponent(next)}`;

  function switchMode(value: string) {
    errors.clear();
    router.replace(`/${value}${query}`);
  }

  async function continueWithGoogle() {
    errors.clear();
    setBusy("google");
    const { error: failed } = await authClient.signIn.social({
      provider: "google",
      callbackURL: next,
      errorCallbackURL: "/sign-in?error=google",
    });
    // On success the browser is already leaving for Google.
    if (failed) {
      setBusy(null);
      errors.report({
        message:
          failed.status === 404 || failed.code === "PROVIDER_NOT_FOUND"
            ? "Google sign-in isn't available yet. Use your email instead."
            : toFormError(failed).message,
      });
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const name = String(form.get("name") ?? "").trim();

    const invalid = validateAuthFields(mode, { name, email, password });
    if (Object.keys(invalid).length > 0) return errors.report({ fields: invalid });

    errors.clear();
    setBusy("email");
    const result = signUp
      ? await authClient.signUp.email({ name, email, password, callbackURL: "/verify?confirmed=1" })
      : await authClient.signIn.email({ email, password });
    if (result.error) {
      setBusy(null);
      const failed = toFormError(result.error);
      errors.report(
        failed.field ? { fields: { [failed.field]: failed.message } } : { message: failed.message },
      );
      return;
    }
    // A new account checks its email first; a returning one goes where it was heading.
    router.replace(signUp ? "/verify" : next);
    router.refresh();
  }

  const fieldError = errors.fieldError;

  return (
    <AuthCard heading={text.heading} subheading={text.subheading}>
      <SegmentedControl
        label="Sign in or create an account"
        options={modes}
        value={mode}
        onChange={switchMode}
      />
      {notice ? <FormMessage tone="success">{notice}</FormMessage> : null}
      <Button
        type="button"
        variant="secondary"
        size="lg"
        fullWidth
        loading={busy === "google"}
        disabled={busy !== null}
        onClick={continueWithGoogle}
      >
        Continue with Google
      </Button>
      <div aria-hidden="true" className="flex items-center gap-3 text-[13px] text-ink-muted">
        <span className="h-px flex-1 bg-line" />
        or with email
        <span className="h-px flex-1 bg-line" />
      </div>
      <form noValidate onSubmit={submit} className="flex flex-col gap-4">
        {signUp ? (
          <TextField
            id="su-name"
            name="name"
            label="Your name"
            autoComplete="name"
            placeholder="Rajwant Prajapati"
            maxLength={80}
            error={fieldError("name")}
          />
        ) : null}
        <TextField
          id="si-email"
          name="email"
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          error={fieldError("email")}
        />
        <TextField
          id="si-password"
          name="password"
          label="Password"
          type="password"
          autoComplete={signUp ? "new-password" : "current-password"}
          maxLength={passwordRules.max}
          helper={signUp ? `At least ${passwordRules.min} characters.` : undefined}
          error={fieldError("password")}
        />
        {signUp ? null : (
          <Link
            href="/reset-password"
            className={`${authLinkClass} -mt-2 self-end text-[14px] font-semibold`}
          >
            Forgot password?
          </Link>
        )}
        {errors.message ? <FormMessage tone="danger">{errors.message}</FormMessage> : null}
        <Button
          type="submit"
          size="lg"
          fullWidth
          loading={busy === "email"}
          disabled={busy !== null}
        >
          {busy === "email" ? text.busy : text.submit}
        </Button>
      </form>
      <p className="m-0 text-[13px] leading-5 text-ink-muted">
        By continuing you agree to the{" "}
        <Link href="/terms" className={authLinkClass}>
          Terms
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className={authLinkClass}>
          Privacy policy
        </Link>
        . We send a link to confirm new email addresses.
      </p>
    </AuthCard>
  );
}
