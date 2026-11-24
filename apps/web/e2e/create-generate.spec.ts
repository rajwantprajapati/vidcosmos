// F20: step 4 of making a video, with the stub voice, the stub AI and the Inngest Dev Server.
// Generate records every scene, saves version 1 and opens the editor, counting one video. A
// scene the voice can't record leaves the video partial: the Generating screen says which, and
// "Retry this scene" records it once its narration is fixed, without counting another video.
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { hideNextDevTools, signUpReady } from "./helpers";

/** The stub voice refuses narration with this phrase (`lib/tts.ts`). */
const failPhrase = "Narration fails here";

/** A new video with its script written and its storyboard built, on step 3. */
async function videoWithStoryboard(page: Page, label: string, topic: string) {
  await signUpReady(page, label);
  await page.goto("/projects/new");
  await hideNextDevTools(page);
  await page.getByLabel("Topic").fill(topic);
  await page.getByRole("button", { name: /^Write (the script )?from the topic$/ }).click();
  // Creating the video waits on the dev server, slow while other tests run alongside.
  await expect(page).toHaveURL(/\/projects\/[0-9a-f]{24}\/script$/, { timeout: 30_000 });
  await expect(page.getByLabel("Script text")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Build the storyboard" }).last().click();
  await expect(page).toHaveURL(/\/projects\/[0-9a-f]{24}\/storyboard$/);
  await expect(page.getByText(/^\d+ scenes · about \d+ s/).filter({ visible: true })).toBeVisible({
    timeout: 30_000,
  });
  return /projects\/([0-9a-f]{24})/.exec(page.url())![1]!;
}

type Scene = { id: string; narration: string; timing: unknown };
type Detail = {
  stage: string;
  currentVersion: number | null;
  draft: { rev: number; spec: { scenes: Scene[] } };
};

const project = async (page: Page, id: string): Promise<Detail> =>
  (await page.request.get(`/api/v1/projects/${id}`)).json();

const videosUsed = async (page: Page): Promise<number> =>
  ((await (await page.request.get("/api/v1/usage")).json()) as { videos: { used: number } }).videos
    .used;

/** Saves the draft as this tab, with one scene's narration changed. */
async function setNarration(page: Page, id: string, index: number, change: (n: string) => string) {
  const editorId = await page.evaluate(() => sessionStorage.getItem("vidcosmos.editorId"));
  const detail = await project(page, id);
  const spec = structuredClone(detail.draft.spec);
  spec.scenes[index]!.narration = change(spec.scenes[index]!.narration);
  const saved = await page.request.put(`/api/v1/projects/${id}/draft`, {
    headers: { "X-Editor-Id": editorId!, Origin: new URL(page.url()).origin },
    data: { baseRev: detail.draft.rev, spec },
  });
  expect(saved.status()).toBe(200);
}

test("Generate records the video and opens the editor", async ({ page }) => {
  test.setTimeout(150_000);
  const id = await videoWithStoryboard(page, "generate-flow", "How tides work");
  const before = await videosUsed(page);
  await page.getByRole("button", { name: "Generate video" }).filter({ visible: true }).click();
  await expect(page).toHaveURL(new RegExp(`/projects/${id}(/generating)?$`), { timeout: 30_000 });
  await expect(page).toHaveURL(new RegExp(`/projects/${id}$`), { timeout: 60_000 });

  const done = await project(page, id);
  expect(done.stage).toBe("ready");
  expect(done.currentVersion).toBe(1);
  expect(done.draft.spec.scenes.every((scene) => scene.timing !== null)).toBe(true);
  expect(await videosUsed(page)).toBe(before + 1);
});

test.describe("a scene that fails", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop",
      "One run is enough; the phone layout has its own test",
    );
  });

  test("saves the rest, says which scene failed, and retries just that scene", async ({ page }) => {
    test.setTimeout(180_000);
    const id = await videoWithStoryboard(page, "generate-partial", "How volcanoes erupt");
    await setNarration(page, id, 1, (n) => `${n} ${failPhrase}.`);
    await page.reload();
    await page.getByRole("button", { name: "Generate video" }).filter({ visible: true }).click();
    await expect(page).toHaveURL(new RegExp(`/projects/${id}/generating$`), { timeout: 30_000 });

    await expect(page.getByRole("heading", { name: "Your video is almost ready" })).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.getByText("Scene 2 · Failed")).toBeVisible();
    // The stage list names the version the run saved (F20 QA).
    await expect(page.getByText("Saved version 1")).toBeVisible();
    await expect(page.getByText(/^One scene has no narration yet\./)).toBeVisible();
    expect(await new AxeBuilder({ page }).analyze()).toHaveProperty("violations", []);
    const partial = await project(page, id);
    expect(partial.currentVersion).toBe(1);
    expect(partial.draft.spec.scenes[1]!.timing).toBeNull();
    const used = await videosUsed(page);

    // Fix the narration, then retry that scene only: version 2, and no other video counted.
    await setNarration(page, id, 1, (n) => n.replace(` ${failPhrase}.`, ""));
    await page.getByRole("button", { name: "Retry this scene" }).click();
    await expect(page).toHaveURL(new RegExp(`/projects/${id}$`), { timeout: 60_000 });
    const fixed = await project(page, id);
    expect(fixed.currentVersion).toBe(2);
    expect(fixed.draft.spec.scenes.every((scene) => scene.timing !== null)).toBe(true);
    expect(await videosUsed(page)).toBe(used);
  });
});
