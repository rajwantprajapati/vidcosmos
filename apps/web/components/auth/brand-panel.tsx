// The dark panel beside the sign-in form (SignIn design): logo, artwork, promise.
import Link from "next/link";
import { Icon, Logo } from "@/components/ui";

const promises = [
  "Explainers, ads, stories and reels from one prompt",
  "Indian narrators in English and Hindi",
  "Change anything by chatting, then post to Instagram",
];

export function BrandPanel() {
  return (
    <section
      data-theme="dark"
      aria-label="About Vidcosmos"
      className="relative box-border flex min-w-0 flex-[1_1_520px] flex-col gap-8 overflow-hidden bg-bg px-12 pt-10 pb-12 text-ink"
    >
      <Link href="/" aria-label="Vidcosmos home" className="inline-flex self-start rounded-md">
        <Logo size={30} title="" />
      </Link>
      <Artwork />
      <div className="relative mt-auto flex max-w-[440px] flex-col gap-5">
        <h1 className="m-0 font-display text-[44px] leading-[48px] font-extrabold tracking-[-0.03em] text-balance">
          Your next video is{" "}
          <span className="rounded-[0.16em] bg-highlight px-[0.12em] text-on-highlight">
            one sentence
          </span>{" "}
          away.
        </h1>
        <ul className="m-0 flex list-none flex-col gap-3 p-0 text-[16px] leading-6 text-ink-secondary">
          {promises.map((promise) => (
            <li key={promise} className="flex gap-3">
              <Icon name="check" className="shrink-0" />
              {promise}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** A phone in orbit. Under 720 px it sits in the flow, above the headline. */
function Artwork() {
  return (
    <svg
      aria-hidden="true"
      width="520"
      height="520"
      viewBox="0 0 520 520"
      className="absolute top-[120px] right-[-120px] opacity-95 max-[720px]:static max-[720px]:-mt-2 max-[720px]:-mb-4 max-[720px]:size-60 max-[720px]:self-center"
    >
      <circle cx="260" cy="260" r="130" fill="var(--brand)" />
      <g className="vc-orbit">
        <g transform="rotate(-16 260 260)" fill="none">
          <ellipse cx="260" cy="260" rx="230" ry="70" stroke="var(--highlight)" strokeWidth="2" />
          <ellipse
            cx="260"
            cy="260"
            rx="250"
            ry="110"
            stroke="var(--line)"
            strokeWidth="1"
            strokeDasharray="2 8"
          />
        </g>
      </g>
      <rect x="215" y="180" width="90" height="160" rx="14" fill="var(--video-midnight-bg)" />
      <rect x="229" y="198" width="50" height="10" rx="3" fill="var(--video-midnight-text)" />
      <rect x="229" y="290" width="26" height="26" rx="7" fill="var(--video-midnight-accent)" />
      <rect x="261" y="290" width="26" height="26" rx="7" fill="var(--video-midnight-highlight)" />
    </svg>
  );
}
