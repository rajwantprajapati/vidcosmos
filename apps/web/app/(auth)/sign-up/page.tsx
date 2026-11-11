import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import { safeReturnTo } from "@/lib/auth-routes";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Create your account · Vidcosmos" };

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const next = safeReturnTo((await searchParams).next);
  if (await getSession()) redirect(next);
  return <AuthForm mode="sign-up" next={next} />;
}
