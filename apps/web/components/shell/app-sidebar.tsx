"use client";

// The desktop sidebar (AppSidebar design): logo, New video, sections, usage, profile.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { buttonClassName, cn, Icon, Logo, UsageMeter } from "@/components/ui";
import { Avatar } from "./avatar";
import { isCurrent, newVideo, sidebarItems } from "./nav";

export type ShellUser = { firstName: string; initials: string; plan: string };
export type ShellUsage = { used: number; max: number; resetsOn: string };

export function AppSidebar({ user, usage }: { user: ShellUser; usage: ShellUsage }) {
  const pathname = usePathname();
  return (
    <aside
      aria-label="App"
      className="sticky top-0 hidden h-dvh w-sidebar shrink-0 flex-col gap-6 overflow-y-auto border-r border-line bg-surface px-4 py-5 md:flex"
    >
      <Link
        href="/"
        aria-label="Vidcosmos home"
        className="inline-flex self-start rounded-md px-2 py-1"
      >
        <Logo size={28} title="" />
      </Link>
      <Link
        href={newVideo.href}
        aria-current={isCurrent(newVideo, pathname) ? "page" : undefined}
        className={buttonClassName({
          fullWidth: true,
          className: "min-h-11 rounded-[10px] text-[15px] leading-5",
        })}
      >
        <Icon name="sparkles" size={18} />
        {newVideo.label}
      </Link>
      <nav aria-label="Sections" className="flex flex-col gap-1">
        {sidebarItems.map((item) => {
          const current = isCurrent(item, pathname);
          const Glyph = item.icon;
          return (
            <Link
              key={item.key}
              href={item.href}
              aria-current={current ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-[15px] leading-[normal] transition-colors duration-[120ms]",
                current
                  ? "bg-brand-soft font-semibold text-brand-text"
                  : "font-medium text-ink-secondary hover:bg-surface-hover hover:text-ink",
              )}
            >
              <Glyph aria-hidden="true" size={20} strokeWidth={1.75} className="shrink-0" />
              <span className="flex-1">{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto flex flex-col gap-5">
        <div className="rounded-[14px] border border-line bg-bg p-4">
          <UsageMeter used={usage.used} max={usage.max} resetsOn={usage.resetsOn} />
        </div>
        <div className="flex items-center gap-3 px-2 py-1">
          <Avatar initials={user.initials} />
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-[14px] leading-[normal] font-semibold">
              {user.firstName}
            </span>
            <span className="text-[12px] leading-[normal] text-ink-muted">{user.plan}</span>
          </span>
        </div>
      </div>
    </aside>
  );
}
