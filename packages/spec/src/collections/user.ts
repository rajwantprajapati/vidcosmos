// The app's fields on Better Auth's `user` collection (DB §3). Better Auth owns the
// collection; `role`, `timeZone`, `locale` and `status` are Better Auth additional fields,
// while `onboarding` and `notificationPrefs` are objects the app writes itself.
import { z } from "zod";
import { date, language } from "./common.ts";

export const userRole = z.enum(["user", "admin"]);
export const userStatus = z.enum(["active", "deleting"]);
export const persona = z.enum(["creator", "educator", "brand", "other"]);

export const onboardingSchema = z.object({
  persona,
  topicArea: z.string().max(80).optional(),
  language,
  completedAt: date.optional(),
});
export type Onboarding = z.infer<typeof onboardingSchema>;

export const notificationPrefsSchema = z.object({
  email: z.object({ videoReady: z.boolean(), posts: z.boolean(), account: z.boolean() }),
});
export type NotificationPrefs = z.infer<typeof notificationPrefsSchema>;

/** Every email type on until the user turns one off (or a hard bounce turns all off). */
export const defaultNotificationPrefs: NotificationPrefs = {
  email: { videoReady: true, posts: true, account: true },
};

export const defaultTimeZone = "Asia/Kolkata";
