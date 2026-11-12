// The app's own fields on Better Auth's `user` documents (DB §3), and onboarding (API §4).
// Better Auth owns the collection; these functions touch only the fields the app owns.
import { type Onboarding, onboardingSchema, type Workspace } from "@vidcosmos/spec/collections";
import type { OnboardingInput } from "@vidcosmos/spec/api";
import type { Db, ObjectId } from "mongodb";
import { workspaceCollection } from "./scoped.ts";

export type AppUserFields = {
  onboarding: Onboarding | null;
  onboardingSkippedAt: Date | null;
};

type UserDocument = {
  _id: ObjectId;
  onboarding?: Onboarding;
  onboardingSkippedAt?: Date;
};

const users = (db: Db) => db.collection<UserDocument>("user");

export async function readAppUserFields(db: Db, userId: ObjectId): Promise<AppUserFields> {
  const user = await users(db).findOne(
    { _id: userId },
    { projection: { onboarding: 1, onboardingSkippedAt: 1 } },
  );
  const onboarding = onboardingSchema.safeParse(user?.onboarding);
  return {
    onboarding: onboarding.success ? onboarding.data : null,
    onboardingSkippedAt: user?.onboardingSkippedAt ?? null,
  };
}

/** True until the user completes onboarding or chooses "Skip for now". */
export function needsOnboarding(fields: AppUserFields): boolean {
  return !fields.onboarding?.completedAt && !fields.onboardingSkippedAt;
}

/**
 * Saves the onboarding answers on the user, and the narration language and narrator as the
 * workspace's defaults for new videos.
 */
export async function saveOnboarding(
  db: Db,
  owner: { userId: ObjectId; workspaceId: ObjectId },
  input: OnboardingInput,
  now = new Date(),
): Promise<{ onboarding: Onboarding; workspace: Workspace }> {
  const onboarding = onboardingSchema.parse({
    persona: input.persona,
    ...(input.topicArea ? { topicArea: input.topicArea } : {}),
    language: input.language,
    completedAt: now,
  });
  await users(db).updateOne(
    { _id: owner.userId },
    { $set: { onboarding, updatedAt: now }, $unset: { onboardingSkippedAt: "" } },
  );
  const workspace = await workspaceCollection(db, "workspaces").findOneAndUpdate(
    { _id: owner.workspaceId },
    {
      $set: {
        "defaults.language": input.language,
        "defaults.voiceGender": input.voiceGender,
        updatedAt: now,
      },
    },
    { returnDocument: "after" },
  );
  if (!workspace) throw new Error("The workspace was not found while saving onboarding.");
  return { onboarding, workspace };
}

/** "Skip for now": nothing is saved except that the screen shouldn't come back. */
export async function skipOnboarding(db: Db, userId: ObjectId, now = new Date()): Promise<void> {
  await users(db).updateOne(
    { _id: userId, onboardingSkippedAt: { $exists: false } },
    { $set: { onboardingSkippedAt: now, updatedAt: now } },
  );
}
