import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Placeholder } from "@/components/shell/page-header";
import { requireSession } from "@/lib/session";

// The title doesn't give the page away either.
export async function generateMetadata(): Promise<Metadata> {
  const { user } = await requireSession("/admin");
  return { title: user.role === "admin" ? "Admin · Vidcosmos" : "Page not found · Vidcosmos" };
}

// The admin console is F33. Anyone who isn't an admin gets a 404, so the page can't be probed.
export default async function AdminPage() {
  const { user } = await requireSession("/admin");
  if (user.role !== "admin") notFound();
  return (
    <Placeholder title="Admin">
      Users, usage, cost per video, failed jobs and limit overrides will show here.
    </Placeholder>
  );
}
