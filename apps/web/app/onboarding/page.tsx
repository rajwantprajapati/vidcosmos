// First-run questions (Onboarding design). Shown once: after it is saved or skipped, the app
// goes straight to the library.
import { needsOnboarding, ObjectId, readAppUserFields } from "@vidcosmos/db";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OnboardingForm } from "@/components/onboarding/onboarding-form";
import { firstNameOf } from "@/components/shell/nav";
import { safeReturnTo } from "@/lib/auth-routes";
import { getDb } from "@/lib/db";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Set up Vidcosmos" };

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const next = safeReturnTo((await searchParams).next);
  const { user, workspace } = await requireSession(
    next === "/library" ? "/onboarding" : `/onboarding?next=${encodeURIComponent(next)}`,
  );
  if (!needsOnboarding(await readAppUserFields(getDb(), new ObjectId(user.id)))) {
    redirect(next);
  }
  return (
    <OnboardingForm
      next={next}
      firstName={firstNameOf(user.name)}
      defaults={{
        language: workspace.defaults.language,
        voiceGender: workspace.defaults.voiceGender,
      }}
    />
  );
}
