// A 404 inside the app (notFound() from an app page, such as a bad project id), shown in the
// shell. Another workspace's project gets this same page (CLAUDE.md, Ownership).
import type { Metadata } from "next";
import { NotFoundMessage } from "@/components/shell/not-found-message";

export const metadata: Metadata = { title: "Page not found · Vidcosmos" };

export default function AppNotFound() {
  return <NotFoundMessage href="/library" action="Go to your library" />;
}
