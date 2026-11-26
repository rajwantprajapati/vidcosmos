// F23: changing scenes by hand in the editor (stub voice and AI, Inngest Dev Server). Editing
// one scene's narration re-records only that scene, checked by each scene's recording; moving
// a scene and changing a template show in the preview at once; scenes can be added,
// duplicated (keeping the recording of its words) and removed; a scene whose words no longer
// say what it shows is marked, and holds the narration until it's fixed.
import { expect, type Page, test } from "@playwright/test";
import { hideNextDevTools, signUpReady } from "./helpers";

type Scene = {
  id: string;
  template: string;
  narration: string;
  timing: { narrationAssetId: string } | null;
};
type Detail = {
  currentVersion: number | null;
  counters: { revisionsUsed: number };
  draft: { rev: number; spec: { scenes: Scene[] } };
};

const project = async (page: Page, id: string): Promise<Detail> =>
  (await page.request.get(`/api/v1/projects/${id}`)).json();

/** A new video, generated with the stub voice, open in the editor. */
async function generatedVideo(page: Page, label: string, topic: string) {
  await signUpReady(page, label);
  await page.goto("/projects/new");
  await hideNextDevTools(page);
  await page.getByLabel("Topic").fill(topic);
  await page.getByRole("button", { name: /^Write (the script )?from the topic$/ }).click();
  await expect(page).toHaveURL(/\/projects\/[0-9a-f]{24}\/script$/, { timeout: 30_000 });
  await expect(page.getByLabel("Script text")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Build the storyboard" }).last().click();
  await expect(page.getByText(/^\d+ scenes · about \d+ s/).filter({ visible: true })).toBeVisible({
    timeout: 30_000,
  });
  const id = /projects\/([0-9a-f]{24})/.exec(page.url())![1]!;
  await page.getByRole("button", { name: "Generate video" }).filter({ visible: true }).click();
  await expect(page).toHaveURL(new RegExp(`/projects/${id}$`), { timeout: 90_000 });
  await hideNextDevTools(page);
  await expect(page.getByTestId("preview")).toBeVisible();
  return id;
}

const more = (page: Page, scene: number) =>
  page.getByRole("button", { name: `More for scene ${scene}` });
const saved = (page: Page) =>
  expect(page.getByText(/^Saved · version/)).toBeVisible({ timeout: 15_000 });

test.describe("scene editing on desktop", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Desktop layout");
  });

  test("editing one scene's narration re-records only that scene", async ({ page }) => {
    test.setTimeout(180_000);
    const id = await generatedVideo(page, "scene-narration", "How UPI moves your money");
    const before = await project(page, id);
    const assetsBefore = before.draft.spec.scenes.map((s) => s.timing?.narrationAssetId);

    await more(page, 2).click();
    await page.getByRole("button", { name: "Edit scene" }).click();
    const editor = page.getByRole("dialog", { name: /Scene 2/ });
    const narration = editor.getByLabel("Narration");
    await narration.fill(`${await narration.inputValue()} It happens every day.`);
    await editor.getByRole("button", { name: "Done" }).click();
    await expect(page.getByText(/^One scene needs narration recorded/)).toBeVisible();
    await saved(page);

    await page.getByRole("button", { name: "Update narration" }).click();
    await expect
      .poll(async () => (await project(page, id)).currentVersion, { timeout: 90_000 })
      .toBe(2);
    const after = await project(page, id);
    const assetsAfter = after.draft.spec.scenes.map((s) => s.timing?.narrationAssetId);
    // Only scene 2 has a new recording; every other scene kept its own.
    expect(assetsAfter[1]).toBeTruthy();
    expect(assetsAfter[1]).not.toBe(assetsBefore[1]);
    assetsAfter.forEach((asset, i) => {
      if (i !== 1) expect(asset, `scene ${i + 1}`).toBe(assetsBefore[i]);
    });
    // Re-recording an edit uses one revision.
    expect(after.counters.revisionsUsed).toBe(before.counters.revisionsUsed + 1);
  });

  test("moving a scene and changing a template show in the preview at once", async ({ page }) => {
    test.setTimeout(180_000);
    const id = await generatedVideo(page, "scene-order", "How tides work");
    const { draft } = await project(page, id);
    const third = draft.spec.scenes[2]!;
    const preview = page.getByTestId("preview");

    // Move scene 3 up: it plays second, straight away.
    await more(page, 3).click();
    await page.getByRole("button", { name: "Move up" }).click();
    await page.getByRole("button", { name: /^02 / }).click();
    await expect(page.getByText(`Scene 2 of ${draft.spec.scenes.length}`)).toBeVisible();
    await expect(page.getByRole("button", { name: /^02 / })).toContainText(
      third.template === "title" ? "Title" : /./,
    );
    await saved(page);
    expect((await project(page, id)).draft.spec.scenes[1]!.id).toBe(third.id);

    // Scene 1 becomes a key term: the row and the preview show it at once.
    await more(page, 1).click();
    await page.getByRole("button", { name: "Edit scene" }).click();
    const editor = page.getByRole("dialog", { name: /Scene 1/ });
    await editor.getByLabel("Template").selectOption("keyTerm");
    await editor.getByRole("button", { name: "Done" }).click();
    await expect(page.getByRole("button", { name: /^01 / })).toContainText("Key term");
    await page.getByRole("button", { name: /^01 / }).click();
    await page.getByLabel("Seek").fill("45");
    await expect(preview.locator("[data-text]").first()).toBeVisible();
    await saved(page);
    expect((await project(page, id)).draft.spec.scenes[0]!.template).toBe("keyTerm");
  });

  test("adds, duplicates and removes scenes", async ({ page }) => {
    test.setTimeout(180_000);
    const id = await generatedVideo(page, "scene-add", "How bees make honey");
    const count = (await project(page, id)).draft.spec.scenes.length;

    await page.getByRole("button", { name: "Add a scene" }).click();
    const editor = page.getByRole("dialog", { name: /Scene \d+/ });
    await expect(editor).toBeVisible();
    await expect(editor.getByLabel("Narration")).toHaveValue("Here is a new scene.");
    await editor.getByRole("button", { name: "Done" }).click();

    await more(page, 1).click();
    await page.getByRole("button", { name: "Duplicate" }).click();
    await saved(page);
    const duplicated = (await project(page, id)).draft.spec.scenes;
    expect(duplicated).toHaveLength(count + 2);
    // The copy comes right after the scene, with its own id.
    expect(duplicated[1]!.narration).toBe(duplicated[0]!.narration);
    expect(duplicated[1]!.id).not.toBe(duplicated[0]!.id);
    // Same words, same voice: the copy plays the original's recording, nothing to record.
    expect(duplicated[1]!.timing?.narrationAssetId).toBeTruthy();
    expect(duplicated[1]!.timing?.narrationAssetId).toBe(duplicated[0]!.timing?.narrationAssetId);
    await expect(page.getByRole("button", { name: /^02 / })).not.toContainText("No narration");

    await more(page, 2).click();
    await page.getByRole("button", { name: "Remove", exact: true }).click();
    const confirm = page.getByRole("dialog", { name: "Remove scene 2?" });
    await confirm.getByRole("button", { name: "Remove scene" }).click();
    await saved(page);
    const left = (await project(page, id)).draft.spec.scenes;
    expect(left).toHaveLength(count + 1);
    expect(left.map((s) => s.id)).not.toContain(duplicated[1]!.id);
  });

  test("marks a scene that needs a fix, and holds the narration until it's fixed", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await generatedVideo(page, "scene-fix", "How rain forms");
    const row = page.getByRole("button", { name: /^02 / });

    await more(page, 2).click();
    await page.getByRole("button", { name: "Edit scene" }).click();
    const editor = page.getByRole("dialog", { name: /Scene 2/ });
    const narration = editor.getByLabel("Narration");
    const words = await narration.inputValue();
    await narration.fill("Completely different words.");
    await editor.getByRole("button", { name: "Done" }).click();

    // The row and a banner say what's wrong; recording waits for the fix.
    await expect(row).toContainText("Needs a fix");
    await expect(page.getByText("Scene 2 needs a fix.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Update narration" })).toBeDisabled();

    await page.getByRole("button", { name: "Edit scene 2" }).click();
    await editor.getByLabel("Narration").fill(words);
    await editor.getByRole("button", { name: "Done" }).click();
    await expect(row).not.toContainText("Needs a fix");
    await expect(page.getByText("Scene 2 needs a fix.")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Update narration" })).toBeEnabled();
  });
});
