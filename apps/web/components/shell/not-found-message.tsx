// The "Page not found" message, inside the app shell or on its own.
import Link from "next/link";
import { buttonClassName } from "@/components/ui";

export function NotFoundMessage({ href, action }: { href: string; action: string }) {
  return (
    <section
      aria-labelledby="not-found-title"
      className="flex max-w-reading flex-col items-start gap-3 py-6"
    >
      <p className="overline m-0 text-ink-muted">Error 404</p>
      <h1
        id="not-found-title"
        className="m-0 font-display text-[28px] leading-[34px] font-extrabold tracking-[-0.025em] md:text-[32px] md:leading-10"
      >
        Page not found
      </h1>
      <p className="body m-0 text-ink-secondary">
        This page doesn’t exist, or you don’t have access to it. Check the address, or carry on from
        your library.
      </p>
      <Link href={href} className={buttonClassName({ size: "lg", className: "mt-3" })}>
        {action}
      </Link>
    </section>
  );
}
