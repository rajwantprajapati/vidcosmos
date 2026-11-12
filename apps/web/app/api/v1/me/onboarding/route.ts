// PUT /api/v1/me/onboarding: save the onboarding answers (API §4).
import { readAppUserFields, readUsage, saveOnboarding } from "@vidcosmos/db";
import { onboardingInput } from "@vidcosmos/spec/api";
import { apiRoute, readJson } from "@/lib/api";
import { getDb } from "@/lib/db";
import { toMeDto } from "@/lib/me";

export const PUT = apiRoute(async ({ request, session, userId, workspace }) => {
  const input = await readJson(request, onboardingInput);
  const db = getDb();
  const saved = await saveOnboarding(db, { userId, workspaceId: workspace._id }, input);
  return toMeDto(
    session,
    await readAppUserFields(db, userId),
    saved.workspace,
    await readUsage(db, saved.workspace),
  );
});
