// After sign-up: "Check your email". The link in the email comes back here with
// ?confirmed=1 (or &error=… when it is expired or already used).
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard, authLinkClass } from "@/components/auth/auth-card";
import { ResendVerification } from "@/components/auth/resend-verification";
import { buttonClassName } from "@/components/ui";
import { appHome } from "@/lib/auth-routes";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Confirm your email · Vidcosmos" };

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ confirmed?: string; error?: string }>;
}) {
  const { confirmed, error } = await searchParams;
  const session = await getSession();
  const continueLink = session ? appHome : "/sign-in";
  const continueLabel = session ? "Continue to Vidcosmos" : "Sign in";

  if (error) {
    return (
      <AuthCard
        heading="That link didn't work"
        subheading="It has expired or was already used. Links work for 24 hours."
      >
        {session && !session.user.emailVerified ? (
          <ResendVerification email={session.user.email} variant="primary" />
        ) : (
          <Link href={continueLink} className={buttonClassName({ size: "lg", fullWidth: true })}>
            {continueLabel}
          </Link>
        )}
      </AuthCard>
    );
  }

  if (confirmed || session?.user.emailVerified) {
    return (
      <AuthCard
        heading="Email confirmed"
        subheading="Thanks. Your account is ready to make videos."
      >
        <Link href={continueLink} className={buttonClassName({ size: "lg", fullWidth: true })}>
          {continueLabel}
        </Link>
      </AuthCard>
    );
  }

  if (!session) redirect("/sign-in");

  return (
    <AuthCard
      heading="Check your email"
      subheading={
        <>
          We sent a link to <strong className="font-semibold text-ink">{session.user.email}</strong>
          . Open it to confirm your address. It works for 24 hours.
        </>
      }
    >
      <Link href={appHome} className={buttonClassName({ size: "lg", fullWidth: true })}>
        Continue to Vidcosmos
      </Link>
      <ResendVerification email={session.user.email} />
      <p className="m-0 text-[13px] leading-5 text-ink-muted">
        You can look around now. Confirm your email before you make your first video.{" "}
        <Link href="/sign-up" className={authLinkClass}>
          Wrong address?
        </Link>
      </p>
    </AuthCard>
  );
}
