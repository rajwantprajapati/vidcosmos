// POST /api/v1/me/onboarding/skip: "Skip for now" on the onboarding screen. Saves no answers,
// only that the screen shouldn't come back (decision log, 11 Nov).
import { readAppUserFields, readUsage, skipOnboarding } from "@vidcosmos/db";
import { apiRoute } from "@/lib/api";
import { getDb } from "@/lib/db";
import { toMeDto } from "@/lib/me";

export const POST = apiRoute(async ({ session, userId, workspace }) => {
  const db = getDb();
  await skipOnboarding(db, userId);
  return toMeDto(
    session,
    await readAppUserFields(db, userId),
    workspace,
    await readUsage(db, workspace),
  );
});
