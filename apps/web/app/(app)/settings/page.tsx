import { readUsage } from "@vidcosmos/db";
import type { Metadata } from "next";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { PageHeader } from "@/components/shell/page-header";
import { UsageMeter } from "@/components/ui";
import { getDb } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { usageView } from "@/lib/usage";

export const metadata: Metadata = { title: "Settings · Vidcosmos" };

// The full settings screen (profile, defaults, Instagram, notifications, delete) is F30.
export default async function SettingsPage() {
  const { user, workspace } = await requireSession("/settings");
  const { usage, taken, resetsOn, exportsResetAt } = usageView(
    await readUsage(getDb(), workspace),
    user.timeZone,
  );
  const { limits } = workspace;
  return (
    <>
      <PageHeader title="Settings" />
      {/* The Usage card of the Settings design; the rest of Settings arrives in F30. */}
      <section
        id="usage"
        aria-labelledby="use-h"
        className="flex max-w-[760px] flex-col gap-5 rounded-[20px] border border-line bg-surface p-7"
      >
        <div className="flex flex-col gap-1">
          <h2 id="use-h" className="m-0 font-display text-[20px] leading-[30px] font-extrabold">
            Usage
          </h2>
          <span className="text-[14px] leading-5 text-ink-muted">
            Free while Vidcosmos is in beta. Limits reset on the 1st of each month (India time).
          </span>
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-6">
          <UsageMeter used={taken} max={usage.videos.max} resetsOn={resetsOn} />
          <UsageMeter
            used={usage.exportsToday.used}
            max={usage.exportsToday.max}
            label="Exports today"
            resetsOn={exportsResetAt}
          />
        </div>
        <ul className="m-0 flex list-disc flex-col gap-1.5 pl-5 text-[14px] leading-[22px] text-ink-secondary">
          <li>
            Each video can have up to {limits.revisionsPerVideo} revisions and{" "}
            {limits.generationsPerVideo} AI requests (ideas, script, storyboard, chat).
          </li>
          <li>
            Up to {limits.concurrentJobs} videos can be generating or exporting at the same time.
          </li>
          <li>A video counts once, when it’s first generated. Revising it doesn’t use another.</li>
        </ul>
      </section>
      <section className="flex max-w-reading flex-col gap-4 rounded-xl border border-line bg-surface p-6">
        <h2 className="h3 m-0">Account</h2>
        <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-[15px] leading-6">
          <dt className="text-ink-muted">Name</dt>
          <dd className="m-0">{user.name}</dd>
          <dt className="text-ink-muted">Email</dt>
          <dd className="m-0 break-all">{user.email}</dd>
          <dt className="text-ink-muted">Workspace</dt>
          <dd className="m-0">{workspace.name}</dd>
        </dl>
        <p className="body-sm m-0 text-ink-muted">More settings arrive soon.</p>
        <SignOutButton />
      </section>
    </>
  );
}
