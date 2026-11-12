// The app shell (F07): the sidebar on desktop; the top bar and tab bar on phones (under 768 px).
// Every page here needs a session (the proxy has already turned away visitors without a
// cookie), and onboarding comes first until it is finished or skipped.
import { readAppUserFields, needsOnboarding, ObjectId } from "@vidcosmos/db";
import { toUsageDto } from "@vidcosmos/spec/api";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppSidebar } from "@/components/shell/app-sidebar";
import { MobileTabBar } from "@/components/shell/mobile-tab-bar";
import { MobileTopBar } from "@/components/shell/mobile-top-bar";
import { firstNameOf, initialsOf } from "@/components/shell/nav";
import { Toaster } from "@/components/toaster";
import { onboardingPath, requestPathHeader } from "@/lib/auth-routes";
import { getDb } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { usageView } from "@/lib/usage";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const { user, workspace } = await requireSession("/library");
  if (needsOnboarding(await readAppUserFields(getDb(), new ObjectId(user.id)))) {
    // Come back to the page that was asked for once onboarding is saved or skipped.
    redirect(onboardingPath((await headers()).get(requestPathHeader)));
  }

  const usage = toUsageDto(workspace, new Date());
  // Shown in the user's own time zone; the reset itself happens at midnight IST.
  const { taken, resetsOn } = usageView(usage, user.timeZone);
  const initials = initialsOf(user.name);

  return (
    <div className="flex min-h-dvh bg-bg font-sans text-ink">
      <AppSidebar
        user={{ firstName: firstNameOf(user.name), initials, plan: "Free beta" }}
        usage={{ used: taken, max: usage.videos.max, resetsOn }}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileTopBar initials={initials} />
        <main className="box-border flex min-w-0 flex-1 flex-col gap-3.5 px-4 pt-1 pb-[110px] md:gap-7 md:px-10 md:pt-7 md:pb-12">
          <Toaster>{children}</Toaster>
        </main>
      </div>
      <MobileTabBar />
    </div>
  );
}
