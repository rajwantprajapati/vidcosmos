import type { ReactNode } from "react";

/** A page's title row: 32 px on desktop, 28 px on phones (Library design). */
export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-center gap-4">
      <h1 className="m-0 min-w-[200px] flex-1 font-display text-[28px] leading-[34px] font-extrabold tracking-[-0.025em] md:text-[32px] md:leading-10">
        {title}
      </h1>
      {children}
    </header>
  );
}

/** Stands in for a screen that a later feature builds. */
export function Placeholder({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <PageHeader title={title} />
      <section className="flex flex-col gap-2 rounded-xl border border-dashed border-line-strong bg-surface p-6">
        <h2 className="h3 m-0">Coming soon</h2>
        <p className="body m-0 max-w-reading text-ink-secondary">{children}</p>
      </section>
    </>
  );
}
