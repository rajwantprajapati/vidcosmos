// /reset-password asks for a link; the link comes back with ?token=… (or ?error=INVALID_TOKEN).
import type { Metadata } from "next";
import { NewPasswordForm, RequestResetForm } from "@/components/auth/reset-password-form";

export const metadata: Metadata = { title: "Reset your password · Vidcosmos" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { token, error } = await searchParams;
  if (token && !error) return <NewPasswordForm token={token} />;
  return <RequestResetForm linkError={Boolean(error)} />;
}
