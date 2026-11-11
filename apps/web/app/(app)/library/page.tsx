// Placeholder for the library (F09) inside the shell (F07): proves a signed-in user reached
// the app, and lets them sign out.
import type { Metadata } from "next";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Library · Vidcosmos" };

export default async function LibraryPage() {
  const { user, workspace } = await requireSession("/library");
  return (
    <main className="mx-auto flex max-w-content flex-col gap-4 px-4 py-10 md:px-6">
      <h1 className="h1">Library</h1>
      <p className="body text-ink-secondary">
        Signed in as <strong className="text-ink">{user.email}</strong> in {workspace.name}.
      </p>
      <SignOutButton />
    </main>
  );
}
