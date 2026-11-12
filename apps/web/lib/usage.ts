// Usage as the screens show it: the counters, when they reset in the user's own time zone, and
// whether the monthly video allowance is used up (API §3 Usage, PRD FR-10.5).
import { type UsageDto, videoAllowance } from "@vidcosmos/spec/api";

export type UsageView = {
  usage: UsageDto;
  /**
   * Videos taken this month: used plus reserved (generations in flight). The meters show this,
   * so they agree with the limit notice (DB §4).
   */
  taken: number;
  /** "1 Dec": when the monthly count starts again, shown in the user's time zone. */
  resetsOn: string;
  /** "midnight", or the time in the user's zone when midnight IST isn't their midnight. */
  exportsResetAt: string;
  allowance: ReturnType<typeof videoAllowance>;
};

/** The day a reset happens, as the user sees it: the reset is midnight IST. */
export function formatResetDay(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone }).format(
    new Date(iso),
  );
}

/**
 * When the daily export count resets, as the user sees it: midnight IST is "midnight" in India
 * and "1:30 pm" in New York.
 */
export function formatResetTime(iso: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone,
  }).formatToParts(new Date(iso));
  const hour = parts.find((p) => p.type === "hour")?.value;
  const minute = parts.find((p) => p.type === "minute")?.value;
  if (hour === "00" && minute === "00") return "midnight";
  return new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", timeZone })
    .format(new Date(iso))
    .toLowerCase();
}

export function usageView(usage: UsageDto, timeZone: string): UsageView {
  return {
    usage,
    taken: usage.videos.used + usage.videos.reserved,
    resetsOn: formatResetDay(usage.period.resetsAt, timeZone),
    exportsResetAt: formatResetTime(usage.exportsToday.resetsAt, timeZone),
    allowance: videoAllowance(usage),
  };
}
