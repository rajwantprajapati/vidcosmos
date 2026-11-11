// The right-hand column of the auth pages: a heading, a line under it, then the content.
import type { ReactNode } from "react";

export function AuthCard({
  heading,
  subheading,
  children,
}: {
  heading: string;
  subheading: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex w-full max-w-[420px] flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="m-0 font-display text-[32px] leading-10 font-extrabold tracking-[-0.025em]">
          {heading}
        </h2>
        <p className="m-0 text-[15px] leading-6 text-ink-muted">{subheading}</p>
      </div>
      {children}
    </div>
  );
}

/** A message for the whole form (not one field). */
export function FormMessage({
  tone,
  children,
}: {
  tone: "danger" | "success";
  children: ReactNode;
}) {
  return (
    <p
      role={tone === "danger" ? "alert" : "status"}
      className={
        tone === "danger"
          ? "m-0 rounded-md border border-danger bg-danger-soft px-3 py-2 text-[14px] leading-5 text-ink"
          : "m-0 rounded-md border border-success bg-success-soft px-3 py-2 text-[14px] leading-5 text-ink"
      }
    >
      {children}
    </p>
  );
}

/** Links in auth copy: brand text, underlined, ink on hover. */
export const authLinkClass = "rounded-sm text-brand-text underline hover:text-ink";
