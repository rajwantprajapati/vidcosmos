"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { authClient } from "@/lib/auth-client";
import { toFormError } from "@/lib/auth-errors";
import { FormMessage } from "./auth-card";

/** "Send the link again" on the verify page. */
export function ResendVerification({
  email,
  variant = "secondary",
}: {
  email: string;
  variant?: "primary" | "secondary";
}) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | { error: string }>("idle");

  async function resend() {
    setState("sending");
    const { error } = await authClient.sendVerificationEmail({
      email,
      callbackURL: "/verify?confirmed=1",
    });
    setState(error ? { error: toFormError(error).message } : "sent");
  }

  return (
    <div className="flex flex-col gap-3">
      {state === "sent" ? (
        <FormMessage tone="success">We sent a new link to {email}.</FormMessage>
      ) : null}
      {typeof state === "object" ? <FormMessage tone="danger">{state.error}</FormMessage> : null}
      <Button
        type="button"
        variant={variant}
        size="lg"
        fullWidth
        loading={state === "sending"}
        disabled={state === "sending"}
        onClick={resend}
      >
        Send the link again
      </Button>
    </div>
  );
}
