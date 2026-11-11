// The glyphs the components use, from Lucide (the design system's icon set) at 1.75 px stroke.
// For any other icon, use lucide-react directly with strokeWidth={1.75} at 16, 20 or 24 px.
import {
  ArrowRight,
  ArrowUp,
  Check,
  Clock,
  Film,
  LoaderCircle,
  type LucideIcon,
  Mic,
  Pencil,
  Play,
  Send,
  Sparkles,
  TriangleAlert,
  X,
} from "lucide-react";
import { cn } from "./cn";

export type IconName =
  | "play"
  | "check"
  | "clock"
  | "alert"
  | "x"
  | "sparkles"
  | "arrow-right"
  | "arrow-up"
  | "mic"
  | "pencil"
  | "loader"
  | "film"
  | "send";

const glyphs: Record<IconName, LucideIcon> = {
  play: Play,
  check: Check,
  clock: Clock,
  alert: TriangleAlert,
  x: X,
  sparkles: Sparkles,
  "arrow-right": ArrowRight,
  "arrow-up": ArrowUp,
  mic: Mic,
  pencil: Pencil,
  loader: LoaderCircle,
  film: Film,
  send: Send,
};

export const iconNames = Object.keys(glyphs) as IconName[];

export type IconProps = {
  name: IconName;
  /** 16, 20 or 24 in the app. Default 20. */
  size?: number;
  /** Only when the icon stands alone and carries meaning; otherwise it is hidden from screen readers. */
  label?: string;
  className?: string;
};

export function Icon({ name, size = 20, label, className }: IconProps) {
  const Glyph = glyphs[name];
  const a11y = label
    ? ({ role: "img", "aria-label": label } as const)
    : ({ "aria-hidden": true } as const);
  return (
    <Glyph
      size={size}
      strokeWidth={1.75}
      focusable="false"
      className={cn(
        "inline-block shrink-0 align-middle",
        name === "loader" && "vc-spin",
        className,
      )}
      {...a11y}
    />
  );
}
