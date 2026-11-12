"use client";

// The phone tab bar (MobileTabBar design), shown under 768 px instead of the sidebar.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui";
import { isCurrent, tabItems } from "./nav";

export function MobileTabBar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="App"
      className="fixed inset-x-0 bottom-0 z-30 grid min-h-[84px] grid-cols-4 items-center border-t border-line bg-surface px-2 pt-2 pb-[max(20px,env(safe-area-inset-bottom))] md:hidden"
    >
      {tabItems.map((item) => {
        const current = isCurrent(item, pathname);
        const isNew = item.key === "new";
        const Glyph = item.icon;
        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={current ? "page" : undefined}
            className={cn(
              "flex min-h-[52px] flex-col items-center justify-center gap-[3px] rounded-lg text-[11px] leading-4",
              current ? "font-bold text-brand-text" : "font-medium text-ink-muted",
            )}
          >
            <span
              className={cn(
                "inline-flex h-8 items-center justify-center rounded-[16px]",
                isNew ? "w-[52px] bg-brand text-on-brand" : "w-14",
                !isNew && current && "bg-brand-soft",
              )}
            >
              <Glyph aria-hidden="true" size={20} strokeWidth={1.9} />
            </span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
