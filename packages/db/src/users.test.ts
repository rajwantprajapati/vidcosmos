import { ObjectId } from "mongodb";
import { beforeAll, describe, expect, it } from "vitest";
import { migrate } from "./migrate.ts";
import { useTestDatabase } from "./testing/database.ts";
import { needsOnboarding, readAppUserFields, saveOnboarding, skipOnboarding } from "./users.ts";
import { ensureWorkspace } from "./workspaces.ts";

const database = useTestDatabase();

beforeAll(async () => {
  await migrate(database.get());
});

async function newUser(name = "Asha Rao") {
  const db = database.get();
  const userId = new ObjectId();
  await db.collection("user").insertOne({
    _id: userId,
    name,
    email: `${userId.toHexString()}@example.com`,
    emailVerified: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const workspace = await ensureWorkspace(db, { id: userId, name });
  return { userId, workspaceId: workspace._id };
}

describe("onboarding", () => {
  it("a new user needs onboarding", async () => {
    const { userId } = await newUser();
    expect(needsOnboarding(await readAppUserFields(database.get(), userId))).toBe(true);
  });

  it("saving stores the answers and sets the workspace's language and narrator", async () => {
    const owner = await newUser();
    const now = new Date("2026-11-11T07:00:00Z");
    const { workspace } = await saveOnboarding(
      database.get(),
      owner,
      {
        persona: "educator",
        topicArea: "Science for class 8",
        language: "hi",
        voiceGender: "male",
      },
      now,
    );
    expect(workspace.defaults).toMatchObject({
      language: "hi",
      voiceGender: "male",
      format: "9:16",
    });

    const fields = await readAppUserFields(database.get(), owner.userId);
    expect(fields.onboarding).toEqual({
      persona: "educator",
      topicArea: "Science for class 8",
      language: "hi",
      completedAt: now,
    });
    expect(needsOnboarding(fields)).toBe(false);
  });

  it("an empty topic area is left out", async () => {
    const owner = await newUser();
    await saveOnboarding(database.get(), owner, {
      persona: "creator",
      language: "en",
      voiceGender: "female",
    });
    const { onboarding } = await readAppUserFields(database.get(), owner.userId);
    expect(onboarding).not.toHaveProperty("topicArea");
  });

  it("skipping keeps the screen away without saving answers", async () => {
    const { userId } = await newUser();
    await skipOnboarding(database.get(), userId);
    const fields = await readAppUserFields(database.get(), userId);
    expect(fields.onboarding).toBeNull();
    expect(fields.onboardingSkippedAt).toBeInstanceOf(Date);
    expect(needsOnboarding(fields)).toBe(false);
  });

  it("saving only touches the user's own workspace", async () => {
    const mine = await newUser();
    const theirs = await newUser("Ravi");
    await saveOnboarding(database.get(), mine, {
      persona: "brand",
      language: "hi",
      voiceGender: "male",
    });
    const other = await database
      .get()
      .collection("workspaces")
      .findOne({ _id: theirs.workspaceId });
    expect(other?.defaults).toMatchObject({ language: "en", voiceGender: "female" });
  });
});
