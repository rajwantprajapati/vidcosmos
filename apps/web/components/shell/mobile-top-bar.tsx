// The top bar on phones (MobileLibrary design): logo and the user's initials. The
// notifications bell joins it with notifications (F31).
import Link from "next/link";
import { Logo } from "@/components/ui";
import { Avatar } from "./avatar";

export function MobileTopBar({ initials }: { initials: string }) {
  return (
    <header className="flex h-14 items-center justify-between pr-2 pl-4 md:hidden">
      <Link href="/" aria-label="Vidcosmos home" className="inline-flex rounded-md">
        <Logo size={24} title="" />
      </Link>
      <Avatar initials={initials} size={34} className="mx-1" />
    </header>
  );
}
