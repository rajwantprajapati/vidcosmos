"use client";

// The library before the first video (Library design, empty state): artwork, the prompt box
// and three ideas that fill it in.
import Link from "next/link";
import { useState } from "react";
import { buttonClassName, Chip } from "@/components/ui";
import { LimitNotice, type VideoLimit } from "./limit-notice";
import { NewVideoComposer } from "./new-video";

const ideas = [
  "How vaccines train your immune system",
  "A reel for my bakery’s new menu",
  "UPI पेमेंट कैसे काम करता है",
];

export function EmptyLibrary({
  defaultFormat,
  limit,
}: {
  defaultFormat: string;
  limit?: VideoLimit;
}) {
  const [value, setValue] = useState("");
  return (
    <section
      aria-labelledby="empty-h"
      className="flex flex-col items-center gap-5 py-10 text-center"
    >
      <svg
        aria-hidden="true"
        width="400"
        height="320"
        viewBox="0 0 400 320"
        className="h-auto max-w-full"
      >
        <circle cx="200" cy="160" r="86" fill="var(--brand)" />
        <g className="vc-orbit-small">
          <g transform="rotate(-16 200 160)" fill="none">
            <ellipse cx="200" cy="160" rx="180" ry="52" stroke="var(--highlight)" strokeWidth="2" />
          </g>
        </g>
        <rect x="170" y="104" width="60" height="106" rx="12" fill="var(--stage)" />
        <path d="M192 140l20 13-20 13z" fill="var(--video-midnight-text)" />
      </svg>
      <h2
        id="empty-h"
        className="m-0 font-display text-[32px] leading-10 font-extrabold tracking-[-0.025em]"
      >
        Make your first video
      </h2>
      <p className="m-0 max-w-[520px] text-[17px] leading-[27px] text-ink-secondary">
        Describe it in a sentence. In a few minutes you’ll have a narrated, animated video to watch,
        change by chatting, and post.
      </p>
      {limit ? <LimitNotice limit={limit} className="w-full max-w-[640px] text-left" /> : null}
      <div className="hidden w-full max-w-[640px] text-left md:block">
        <NewVideoComposer
          limit={limit}
          id="lib-first"
          defaultFormat={defaultFormat}
          placeholder="A 60-second explainer on…"
          value={value}
          onValueChange={setValue}
        />
      </div>
      <div className="hidden max-w-[640px] flex-wrap justify-center gap-2 md:flex">
        <span className="w-full text-[13px] text-ink-muted">Or try one of these</span>
        {ideas.map((idea) => (
          <Chip
            key={idea}
            lang={/[ऀ-ॿ]/.test(idea) ? "hi" : undefined}
            onClick={() => {
              setValue(idea);
              document.getElementById("lib-first")?.focus();
            }}
          >
            {idea}
          </Chip>
        ))}
      </div>
      {limit ? null : (
        <Link
          href="/projects/new"
          className={buttonClassName({ size: "lg", className: "md:hidden" })}
        >
          Start a new video
        </Link>
      )}
    </section>
  );
}
