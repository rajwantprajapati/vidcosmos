// The library filters: All, Drafts, Ready, Failed, each with its count (Library design). The
// design's "Scheduled" chip joins with posts (F28). Links, so a filter is in the address.
import Link from "next/link";
import { chipClassName } from "@/components/ui";

export type StageFilter = "all" | "draft" | "ready" | "failed";

const filters: { value: StageFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "draft", label: "Drafts" },
  { value: "ready", label: "Ready" },
  { value: "failed", label: "Failed" },
];

export function FilterChips({
  current,
  counts,
  q,
}: {
  current: StageFilter;
  counts: Record<StageFilter, number>;
  q?: string;
}) {
  return (
    <div
      role="group"
      aria-label="Filter videos"
      className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:flex-wrap md:gap-1.5 md:overflow-visible md:px-0"
    >
      {filters.map((filter) => {
        const params = new URLSearchParams();
        if (filter.value !== "all") params.set("stage", filter.value);
        if (q) params.set("q", q);
        const query = params.toString();
        const selected = filter.value === current;
        return (
          <Link
            key={filter.value}
            href={query ? `/library?${query}` : "/library"}
            aria-current={selected ? "page" : undefined}
            scroll={false}
            className={chipClassName({ selected, className: "no-underline" })}
          >
            {filter.label} <span className="tabular-nums">{counts[filter.value]}</span>
          </Link>
        );
      })}
    </div>
  );
}
