import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import { safeReturnTo } from "@/lib/auth-routes";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Sign in · Vidcosmos" };

const notices: Record<string, string> = {
  reset: "Your password is changed. Sign in with the new one.",
};

const errors: Record<string, string> = {
  google: "Google sign-in didn't finish. Try again, or use your email.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; notice?: string; error?: string }>;
}) {
  const { next: rawNext, notice, error } = await searchParams;
  const next = safeReturnTo(rawNext);
  if (await getSession()) redirect(next);
  return (
    <AuthForm
      mode="sign-in"
      next={next}
      notice={notice ? notices[notice] : undefined}
      initialError={error ? errors[error] : undefined}
    />
  );
}
