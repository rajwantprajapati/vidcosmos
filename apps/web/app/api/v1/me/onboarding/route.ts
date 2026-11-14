// PUT /api/v1/me/onboarding: save the onboarding answers (API §4). The topic area feeds idea
// suggestions, so it's moderated on save like a topic (decision log, 14 Nov).
import { readAppUserFields, readUsage, saveOnboarding } from "@vidcosmos/db";
import { onboardingInput } from "@vidcosmos/spec/api";
import { apiRoute, readJson } from "@/lib/api";
import { getDb } from "@/lib/db";
import { toMeDto } from "@/lib/me";
import { requireAllowed } from "@/lib/moderation";

export const PUT = apiRoute(async ({ request, session, userId, workspace }) => {
  const input = await readJson(request, onboardingInput);
  await requireAllowed({ userId, workspaceId: workspace._id }, [
    input.topicArea ? { kind: "topic", text: input.topicArea } : null,
  ]);
  const db = getDb();
  const saved = await saveOnboarding(db, { userId, workspaceId: workspace._id }, input);
  return toMeDto(
    session,
    await readAppUserFields(db, userId),
    saved.workspace,
    await readUsage(db, saved.workspace),
  );
});
