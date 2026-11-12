"use client";

// "Search videos": filters the library by title and topic as you type (300 ms after the last
// key), keeping the stage filter. Under 2 characters shows everything again.
import { Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export function SearchBox({ defaultValue = "" }: { defaultValue?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(defaultValue);

  // The address can change the search from outside ("Show all videos", Back): follow it.
  const urlQ = searchParams.get("q") ?? "";
  const [seenUrlQ, setSeenUrlQ] = useState(urlQ);
  if (urlQ !== seenUrlQ) {
    setSeenUrlQ(urlQ);
    if (urlQ !== (value.trim().length >= 2 ? value.trim() : "")) setValue(urlQ);
  }

  useEffect(() => {
    const q = value.trim().length >= 2 ? value.trim() : "";
    // Only when the text differs from the address: mounting (twice, in development) and a
    // filter change must not navigate, or they would cancel a navigation already under way.
    if (q === urlQ) return;
    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams);
      if (q) params.set("q", q);
      else params.delete("q");
      params.delete("limit");
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    }, 300);
    return () => clearTimeout(timer);
  }, [value, urlQ, searchParams, pathname, router]);

  return (
    <div role="search" className="relative w-full min-w-[200px] md:w-auto md:flex-[0_1_320px]">
      <Search
        aria-hidden="true"
        size={18}
        strokeWidth={1.75}
        className="pointer-events-none absolute top-[13px] left-[13px] text-ink-muted"
      />
      <label htmlFor="lib-search" className="sr-only">
        Search videos
      </label>
      <input
        id="lib-search"
        type="search"
        placeholder="Search videos"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        maxLength={100}
        className="box-border min-h-11 w-full rounded-[12px] border border-line-strong bg-surface py-2.5 pr-3.5 pl-10 text-[16px] text-ink placeholder:text-ink-muted md:rounded-[10px] md:text-[15px]"
      />
    </div>
  );
}
