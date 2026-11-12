// Builds the `Me` response (API §4) for the signed-in user.
import "server-only";
import type { AppUserFields } from "@vidcosmos/db";
import { type MeDto, toOnboardingDto, toUsageDto, toWorkspaceDto } from "@vidcosmos/spec/api";
import type { Workspace } from "@vidcosmos/spec/collections";
import type { Session } from "./auth";

export function toMeDto(
  session: Session,
  fields: AppUserFields,
  workspace: Workspace,
  now = new Date(),
): MeDto {
  const { user } = session;
  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      image: user.image ?? null,
      role: user.role === "admin" ? "admin" : "user",
      timeZone: user.timeZone,
      locale: user.locale === "hi" ? "hi" : "en",
      createdAt: new Date(user.createdAt).toISOString(),
    },
    onboarding: toOnboardingDto(fields.onboarding),
    workspace: toWorkspaceDto(workspace),
    usage: toUsageDto(workspace, now),
    // Instagram connections arrive in F27.
    instagram: null,
  };
}
