// The Vidcosmos logo, ported from design/design-system/logos.
//
// The logo has fixed brand colours in both themes (don't recolour it), so it uses the
// primitive tokens directly: the one place in the app where primitives are allowed.
// teal-500 disc, coral-500 orbit, slate-900 play symbol; wordmark slate-900 or night-50.
import { useId } from "react";
import type { SVGProps } from "react";
import { wordmarkPath } from "./wordmark-path";

type LogoProps = Omit<SVGProps<SVGSVGElement>, "viewBox" | "children"> & {
  /** Accessible name. Pass "" when a visible label next to the logo already names it. */
  title?: string;
};

function MarkShapes({ clipId }: { clipId: string }) {
  return (
    <>
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
          fill="none"
          stroke="var(--coral-500)"
          strokeWidth="2.6"
        />
      </g>
      <circle cx="22" cy="22" r="16.5" fill="var(--teal-500)" />
      <g transform="rotate(-24 22 22)">
        <ellipse
          cx="22"
          cy="22"
          rx="21"
          ry="7.2"
          fill="none"
          stroke="var(--coral-500)"
          strokeWidth="2.6"
          clipPath={`url(#${clipId})`}
        />
      </g>
      <path
        d="M18.6 15.2 L28.6 22 L18.6 28.8 Z"
        fill="var(--slate-900)"
        stroke="var(--slate-900)"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
    </>
  );
}

function a11y(title: string | undefined) {
  const label = title ?? "Vidcosmos";
  return label === "" ? { "aria-hidden": true } : { role: "img", "aria-label": label };
}

/** The mark alone: app icons, favicons and small spaces. Minimum 20 px. */
export function LogoMark({ title, width = 44, height = 44, ...props }: LogoProps) {
  const clipId = `vc-front-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return (
    <svg viewBox="0 0 44 44" width={width} height={height} {...a11y(title)} {...props}>
      <MarkShapes clipId={clipId} />
    </svg>
  );
}

/**
 * The full logo: mark and wordmark. `reversed` is for dark grounds and the stage.
 * Minimum 96 px wide.
 */
export function LogoFull({
  title,
  reversed = false,
  width = 262,
  height = 44,
  ...props
}: LogoProps & { reversed?: boolean }) {
  const clipId = `vc-front-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return (
    <svg viewBox="0 0 262 44" width={width} height={height} {...a11y(title)} {...props}>
      <MarkShapes clipId={clipId} />
      <path
        transform="translate(54 12)"
        fill={reversed ? "var(--night-50)" : "var(--slate-900)"}
        d={wordmarkPath}
      />
    </svg>
  );
}
