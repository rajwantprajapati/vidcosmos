// The Vidcosmos logo, drawn with theme tokens so it follows light and dark mode:
// teal disc (brand), coral orbit (highlight), play symbol (on-brand), wordmark (ink).
// For files (social images, favicons, documents) use the SVGs in design/design-system/logos.
import { useId } from "react";
import { cn } from "./cn";
import { wordmarkPath } from "./wordmark-path";

export type LogoProps = {
  /** full: mark and wordmark (min 96 px wide). mark: the disc alone (min 20 px). */
  variant?: "full" | "mark";
  /** Height in px. Default 32. */
  size?: number;
  /** Accessible name, default "Vidcosmos". Pass "" when visible text next to it already names it. */
  title?: string;
  className?: string;
};

export function Logo({ variant = "full", size = 32, title = "Vidcosmos", className }: LogoProps) {
  // useId() can contain characters (":", "«") that break url(#…) references.
  const clipId = `vc-front-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const full = variant === "full";
  const a11y =
    title === ""
      ? ({ "aria-hidden": true } as const)
      : ({ role: "img", "aria-label": title } as const);

  return (
    <svg
      viewBox={full ? "0 0 262 44" : "0 0 44 44"}
      height={size}
      width={full ? (size * 262) / 44 : size}
      className={cn("block", className)}
      {...a11y}
    >
      <defs>
        <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
          <rect x="-4" y="22" width="52" height="26" />
        </clipPath>
      </defs>
      {/* The orbit behind the disc, the disc, then the front half of the orbit over it. */}
      <g transform="rotate(-24 22 22)">
        <ellipse
          cx="22"
          cy="22"
          rx="21"
          ry="7.2"
          strokeWidth="2.6"
          className="fill-none stroke-highlight"
        />
      </g>
      <circle cx="22" cy="22" r="16.5" className="fill-brand" />
      <g transform="rotate(-24 22 22)">
        <ellipse
          cx="22"
          cy="22"
          rx="21"
          ry="7.2"
          strokeWidth="2.6"
          clipPath={`url(#${clipId})`}
          className="fill-none stroke-highlight"
        />
      </g>
      <path
        d="M18.6 15.2 L28.6 22 L18.6 28.8 Z"
        strokeWidth="2.4"
        strokeLinejoin="round"
        className="fill-on-brand stroke-on-brand"
      />
      {full ? <path transform="translate(54 12)" d={wordmarkPath} className="fill-ink" /> : null}
    </svg>
  );
}
