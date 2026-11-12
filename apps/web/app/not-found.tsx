// Any address that matches no route at all, outside the app shell.
import type { Metadata } from "next";
import Link from "next/link";
import { NotFoundMessage } from "@/components/shell/not-found-message";
import { Logo } from "@/components/ui";

export const metadata: Metadata = { title: "Page not found · Vidcosmos" };

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col bg-bg font-sans text-ink">
      <header className="px-4 py-5 md:px-10">
        <Link href="/" aria-label="Vidcosmos home" className="inline-flex rounded-md">
          <Logo size={28} title="" />
        </Link>
      </header>
      <main className="flex flex-1 justify-center px-4 pt-10 pb-16">
        <div className="w-full max-w-reading">
          <NotFoundMessage href="/library" action="Go to your library" />
        </div>
      </main>
    </div>
  );
}
