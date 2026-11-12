// GET /api/v1/me: the user, their onboarding, workspace and usage in one call (API §4).
import { readAppUserFields, readUsage } from "@vidcosmos/db";
import { apiRoute } from "@/lib/api";
import { getDb } from "@/lib/db";
import { toMeDto } from "@/lib/me";

export const GET = apiRoute(async ({ session, userId, workspace }) => {
  const db = getDb();
  return toMeDto(
    session,
    await readAppUserFields(db, userId),
    workspace,
    await readUsage(db, workspace),
  );
});
