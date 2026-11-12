// Account responses and requests (API §3 Usage, §4 Me, Workspace, Onboarding), with the
// mappers that build them from database documents. Responses never carry internal fields.
import { z } from "zod";
import {
  audienceLevel,
  captionStyle,
  language,
  lengthSec,
  palette,
  tone,
  videoFormat,
  voiceGender,
} from "../collections/common.ts";
import { onboardingSchema, persona, userRole, type Onboarding } from "../collections/user.ts";
import type { Workspace } from "../collections/workspace.ts";
import { istPeriod, nextIstMidnight, nextIstMonthStart } from "../time.ts";
import { controlCharacterMessage, isPlainText } from "./text.ts";

const id = z.string().regex(/^[0-9a-f]{24}$/);
const iso = z.iso.datetime();

/** Workspace defaults for new videos: ProjectSettings without voiceSpeed (API §4). */
export const workspaceDefaultsDto = z.object({
  format: videoFormat,
  language,
  voiceGender,
  tone,
  audienceLevel,
  lengthSec,
  palette,
  captionStyle,
  musicTrackId: z.string().nullable(),
});

export const workspaceDto = z.object({
  id,
  name: z.string(),
  defaults: workspaceDefaultsDto,
  blocked: z.boolean(),
});
export type WorkspaceDto = z.infer<typeof workspaceDto>;

export const usageDto = z.object({
  period: z.object({ key: z.string(), startsAt: iso, resetsAt: iso }),
  videos: z.object({ used: z.int(), reserved: z.int(), max: z.int() }),
  exportsToday: z.object({ used: z.int(), max: z.int(), resetsAt: iso }),
  concurrentJobs: z.object({ active: z.int(), max: z.int() }),
  perVideo: z.object({ revisionsMax: z.int(), generationsMax: z.int() }),
});
export type UsageDto = z.infer<typeof usageDto>;

export const onboardingDto = z.object({
  persona,
  topicArea: z.string().nullable(),
  language,
  completedAt: iso.nullable(),
});

export const meDto = z.object({
  user: z.object({
    id,
    name: z.string(),
    email: z.string(),
    emailVerified: z.boolean(),
    image: z.string().nullable(),
    role: userRole,
    timeZone: z.string(),
    locale: language,
    createdAt: iso,
  }),
  /** Null while onboarding hasn't been completed: the app shows it (or the user skipped it). */
  onboarding: onboardingDto.nullable(),
  workspace: workspaceDto,
  usage: usageDto,
  instagram: z
    .object({ status: z.enum(["connected", "expiring", "revoked"]), username: z.string() })
    .nullable(),
});
export type MeDto = z.infer<typeof meDto>;

/**
 * PUT /me/onboarding. `voiceGender` is the default narrator from the onboarding screen; it is
 * not in API §4's type, which predates the screen (decision log, 11 Nov).
 */
export const onboardingInput = z.object({
  persona,
  topicArea: z
    .string()
    .trim()
    .max(80)
    .refine(isPlainText(false), controlCharacterMessage)
    .optional(),
  language,
  voiceGender,
});
export type OnboardingInput = z.infer<typeof onboardingInput>;

// Re-exported so callers validate stored onboarding with the same schema.
export { onboardingSchema };

// ---- Mappers ----

type HasHex = { toHexString(): string };

export function toWorkspaceDto(workspace: Workspace): WorkspaceDto {
  return {
    id: (workspace._id as HasHex).toHexString(),
    name: workspace.name,
    defaults: { ...workspace.defaults },
    blocked: workspace.flags.blocked,
  };
}

/**
 * Usage against the workspace limits. Counters stored for an earlier IST month or day read as
 * zero: the next reservation rolls them over in the database (DB §11).
 */
export function toUsageDto(workspace: Workspace, now: Date, activeJobs = 0): UsageDto {
  const { periodKey, periodStart, dayKey } = istPeriod(now);
  const sameMonth = workspace.usage.periodKey === periodKey;
  const sameDay = workspace.usage.exportsDayKey === dayKey;
  return {
    period: {
      key: periodKey,
      startsAt: periodStart.toISOString(),
      resetsAt: nextIstMonthStart(now).toISOString(),
    },
    videos: {
      used: sameMonth ? workspace.usage.videosUsed : 0,
      reserved: sameMonth ? workspace.usage.videosReserved : 0,
      max: workspace.limits.videosPerMonth,
    },
    exportsToday: {
      used: sameDay ? workspace.usage.exportsToday : 0,
      max: workspace.limits.exportsPerDay,
      resetsAt: nextIstMidnight(now).toISOString(),
    },
    concurrentJobs: { active: activeJobs, max: workspace.limits.concurrentJobs },
    perVideo: {
      revisionsMax: workspace.limits.revisionsPerVideo,
      generationsMax: workspace.limits.generationsPerVideo,
    },
  };
}

export function toOnboardingDto(onboarding: Onboarding | null | undefined) {
  if (!onboarding?.completedAt) return null;
  return {
    persona: onboarding.persona,
    topicArea: onboarding.topicArea ?? null,
    language: onboarding.language,
    completedAt: onboarding.completedAt.toISOString(),
  };
}
