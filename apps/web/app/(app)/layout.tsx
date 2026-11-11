// Every app page needs a signed-in user. The proxy already sent visitors without a session
// cookie to sign-in; this checks the session itself. The app shell arrives in F07.
import type { ReactNode } from "react";
import { requireSession } from "@/lib/session";

export default async function AppLayout({ children }: { children: ReactNode }) {
  await requireSession("/library");
  return <div className="min-h-dvh bg-bg text-ink">{children}</div>;
}
