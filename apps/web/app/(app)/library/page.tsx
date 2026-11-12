// The library (Library design): start a new video, search, filter by stage, and the videos,
// newest first. Rendered on the server from the database; actions go through the projects API.
import { activeJobs, countProjects, listProjects, ObjectId } from "@vidcosmos/db";
import { listProjectsQuery, stripControlCharacters, toUsageDto } from "@vidcosmos/spec/api";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyLibrary } from "@/components/library/empty-library";
import { FilterChips, type StageFilter } from "@/components/library/filter-chips";
import { LibraryCard } from "@/components/library/library-card";
import { NewVideoSection } from "@/components/library/new-video";
import { SearchBox } from "@/components/library/search-box";
import { PageHeader } from "@/components/shell/page-header";
import { buttonClassName } from "@/components/ui";
import { getDb } from "@/lib/db";
import { libraryCard } from "@/lib/library";
import { requireSession } from "@/lib/session";
import { usageView } from "@/lib/usage";

export const metadata: Metadata = { title: "Library · Vidcosmos" };

const pageSize = 24;
const stages: StageFilter[] = ["draft", "ready", "failed"];

type Search = { stage?: string; q?: string; trash?: string; limit?: string };

export default async function LibraryPage({ searchParams }: { searchParams: Promise<Search> }) {
  const { user, workspace } = await requireSession("/library");
  const params = await searchParams;
  const stage = stages.find((s) => s === params.stage) ?? "all";
  const q = stripControlCharacters(params.q ?? "")
    .trim()
    .slice(0, 100);
  const trash = params.trash === "true";
  const limit = Math.min(100, Math.max(pageSize, Number(params.limit) || pageSize));

  const db = getDb();
  const owner = { workspaceId: workspace._id, userId: new ObjectId(user.id) };
  const [counts, page] = await Promise.all([
    countProjects(db, workspace._id),
    listProjects(
      db,
      workspace._id,
      listProjectsQuery.parse({
        ...(stage !== "all" ? { stage } : {}),
        ...(q.length >= 2 ? { q } : {}),
        trash: String(trash),
        limit: String(limit),
      }),
    ),
  ]);
  const jobs = await activeJobs(db, owner, page.items);
  const cards = page.items.map((project) =>
    libraryCard(project, project.activeJobId ? jobs.get(project.activeJobId.toHexString()) : null),
  );
  const defaultFormat = workspace.defaults.format;
  // At the monthly limit, Generate is off until the reset (PRD FR-10.5).
  const usage = usageView(toUsageDto(workspace, new Date()), user.timeZone);
  const videoLimit = usage.allowance.reached
    ? { max: usage.usage.videos.max, resetsOn: usage.resetsOn }
    : undefined;

  const moreHref = (() => {
    const next = new URLSearchParams();
    if (stage !== "all") next.set("stage", stage);
    if (q) next.set("q", q);
    if (trash) next.set("trash", "true");
    next.set("limit", String(limit + pageSize));
    return `/library?${next}`;
  })();

  if (trash) {
    return (
      <>
        <PageHeader title="Trash" />
        <p className="body m-0 max-w-reading text-ink-secondary">
          Videos in Trash are deleted for good 30 days after you move them here.{" "}
          <Link
            id="trash-back"
            href="/library"
            className="font-semibold text-brand-text underline hover:text-ink"
          >
            Back to your library
          </Link>
        </p>
        {cards.length ? (
          <VideoGrid>
            {cards.map((card) => (
              <LibraryCard key={card.id} card={card} />
            ))}
          </VideoGrid>
        ) : (
          <p className="body m-0 text-ink-muted">Trash is empty.</p>
        )}
        {page.nextCursor && limit < 100 ? <ShowMore href={moreHref} /> : null}
      </>
    );
  }

  if (counts.all === 0) {
    return (
      <>
        <PageHeader title="Your library" />
        <EmptyLibrary defaultFormat={defaultFormat} limit={videoLimit} />
        {counts.trash > 0 ? <TrashLink count={counts.trash} /> : null}
      </>
    );
  }

  return (
    <>
      <PageHeader title="Your library">
        <SearchBox defaultValue={q} />
      </PageHeader>
      <NewVideoSection defaultFormat={defaultFormat} limit={videoLimit} />
      <section aria-labelledby="videos-h" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2
            id="videos-h"
            className="m-0 hidden font-display text-[20px] leading-[30px] font-extrabold md:block"
          >
            Videos
          </h2>
          <FilterChips
            current={stage}
            q={q.length >= 2 ? q : undefined}
            counts={{
              all: counts.all,
              draft: counts.draft,
              ready: counts.ready,
              failed: counts.failed,
            }}
          />
        </div>
        {cards.length && q.length >= 2 ? (
          // The chips count the whole library (as in the design); this says what the search found.
          <p role="status" className="body-sm m-0 text-ink-muted">
            {page.nextCursor ? `More than ${cards.length}` : cards.length}{" "}
            {cards.length === 1 && !page.nextCursor ? "video matches" : "videos match"} “{q}”
          </p>
        ) : null}
        {cards.length ? (
          <VideoGrid>
            {cards.map((card) => (
              <LibraryCard key={card.id} card={card} />
            ))}
          </VideoGrid>
        ) : (
          <div className="flex flex-col items-start gap-3 py-6">
            <p className="body m-0 text-ink-secondary">
              {q.length >= 2 ? `No videos match “${q}”.` : "No videos here yet."}
            </p>
            <Link href="/library" className={buttonClassName({ variant: "secondary" })}>
              Show all videos
            </Link>
          </div>
        )}
        {page.nextCursor && limit < 100 ? <ShowMore href={moreHref} /> : null}
      </section>
      {counts.trash > 0 ? <TrashLink count={counts.trash} /> : null}
    </>
  );
}

function VideoGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-3.5 md:grid-cols-[repeat(auto-fill,minmax(176px,1fr))] md:gap-5">
      {children}
    </div>
  );
}

function ShowMore({ href }: { href: string }) {
  return (
    <Link
      href={href}
      scroll={false}
      className={buttonClassName({ variant: "secondary", className: "self-center" })}
    >
      Show more videos
    </Link>
  );
}

function TrashLink({ count }: { count: number }) {
  return (
    <Link
      href="/library?trash=true"
      className="self-start text-[14px] font-semibold text-ink-secondary underline hover:text-ink"
    >
      Trash <span className="tabular-nums">({count})</span>
    </Link>
  );
}
