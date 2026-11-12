import type { Metadata } from "next";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { PageHeader } from "@/components/shell/page-header";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Settings · Vidcosmos" };

// The full settings screen (profile, defaults, Instagram, notifications, delete) is F30.
export default async function SettingsPage() {
  const { user, workspace } = await requireSession("/settings");
  return (
    <>
      <PageHeader title="Settings" />
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
