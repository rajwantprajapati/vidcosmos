// F22: no edit is lost and two tabs never overwrite each other (stub AI and voice, Inngest Dev
// Server). Edits made offline are kept and saved on reconnecting; a second tab is read-only with
// "Take over editing"; a change made elsewhere shows "This video changed in another place" and
// offers this tab's edits back instead of overwriting either; an editor setting changed offline
// is saved on reconnecting.
import { expect, type Page, test } from "@playwright/test";
import { hideNextDevTools, signUpReady } from "./helpers";

type Scene = { id: string; template: string };
type Detail = {
  draft: { rev: number; spec: { title: string; theme: { palette: string }; scenes: Scene[] } };
};

const project = async (page: Page, id: string): Promise<Detail> =>
  (await page.request.get(`/api/v1/projects/${id}`)).json();

/** A new video with its storyboard built, on step 3. */
async function videoWithStoryboard(page: Page, label: string, topic: string) {
  await signUpReady(page, label);
  await page.goto("/projects/new");
  await hideNextDevTools(page);
  await page.getByLabel("Topic").fill(topic);
  await page.getByRole("button", { name: /^Write (the script )?from the topic$/ }).click();
  await expect(page).toHaveURL(/\/projects\/[0-9a-f]{24}\/script$/, { timeout: 30_000 });
  await expect(page.getByLabel("Script text")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Build the storyboard" }).last().click();
  await expect(page).toHaveURL(/\/projects\/[0-9a-f]{24}\/storyboard$/, { timeout: 30_000 });
  await expect(page.getByText(/^\d+ scenes · about \d+ s/).filter({ visible: true })).toBeVisible({
    timeout: 30_000,
  });
  return /projects\/([0-9a-f]{24})/.exec(page.url())![1]!;
}

const templateOf = (page: Page, scene: number) =>
  page.getByRole("listitem", { name: `Scene ${scene}` }).getByLabel("Template");

test.describe("autosave on desktop", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Desktop layout");
  });

  test("keeps edits made offline and saves them on reconnecting", async ({ page, context }) => {
    test.setTimeout(150_000);
    const id = await videoWithStoryboard(page, "autosave-offline", "How bees make honey");
    await context.setOffline(true);
    await templateOf(page, 2).selectOption("timeline");
    await templateOf(page, 3).selectOption("keyTerm");
    await expect(page.getByText("Offline – changes kept locally", { exact: true })).toBeVisible({
      timeout: 10_000,
    });

    await context.setOffline(false);
    await expect(page.getByText(/^Saved( just now)?$/)).toBeVisible({ timeout: 20_000 });
    const saved = await project(page, id);
    expect(saved.draft.spec.scenes[1]!.template).toBe("timeline");
    expect(saved.draft.spec.scenes[2]!.template).toBe("keyTerm");
  });

  test("a second tab is read-only until it takes over editing", async ({ page, context }) => {
    test.setTimeout(150_000);
    const id = await videoWithStoryboard(page, "autosave-tabs", "How clouds form");
    const second = await context.newPage();
    await second.goto(`/projects/${id}/storyboard`);
    await hideNextDevTools(second);
    await expect(second.getByText("You have this video open in another tab.")).toBeVisible();
    await expect(templateOf(second, 2)).toBeDisabled();

    await second.getByRole("button", { name: "Take over editing" }).click();
    await expect(templateOf(second, 2)).toBeEnabled();
    // The first tab finds out on its next save and stops: nothing is overwritten.
    await templateOf(page, 2).selectOption("timeline");
    await expect(page.getByText("You have this video open in another tab.")).toBeVisible({
      timeout: 15_000,
    });
    expect((await project(page, id)).draft.spec.scenes[1]!.template).not.toBe("timeline");
  });

  test("a change made elsewhere is never silently overwritten", async ({ page }) => {
    test.setTimeout(150_000);
    const id = await videoWithStoryboard(page, "autosave-conflict", "How tides work");
    // Another writer saves first (with this tab's lease), moving the draft's rev on.
    const editorId = await page.evaluate(() => sessionStorage.getItem("vidcosmos.editorId"));
    const before = await project(page, id);
    const elsewhere = structuredClone(before.draft.spec);
    elsewhere.title = "Changed in another place";
    const put = await page.request.put(`/api/v1/projects/${id}/draft`, {
      headers: { "X-Editor-Id": editorId!, Origin: new URL(page.url()).origin },
      data: { baseRev: before.draft.rev, spec: elsewhere },
    });
    expect(put.status()).toBe(200);

    // This tab's edit is over the old rev: refused, shown, and offered back.
    await templateOf(page, 2).selectOption("timeline");
    await expect(page.getByText(/^This video changed in another place\./)).toBeVisible({
      timeout: 15_000,
    });
    expect((await project(page, id)).draft.spec.scenes[1]!.template).not.toBe("timeline");

    await page.getByRole("button", { name: "Use my changes" }).click();
    await expect(page.getByText(/^Saved( just now)?$/)).toBeVisible({ timeout: 15_000 });
    const after = await project(page, id);
    expect(after.draft.spec.scenes[1]!.template).toBe("timeline");
    expect(after.draft.rev).toBeGreaterThan(before.draft.rev + 1);
  });

  test("an edit right before leaving is never lost (F22 QA)", async ({ page }) => {
    test.setTimeout(150_000);
    const id = await videoWithStoryboard(page, "autosave-leave", "How rivers carve canyons");
    // Reloading at once: the closing tab's release carries the change and saves it first.
    await templateOf(page, 2).selectOption("timeline");
    await page.reload();
    await expect
      .poll(async () => (await project(page, id)).draft.spec.scenes[1]!.template, {
        timeout: 15_000,
      })
      .toBe("timeline");
    await expect(templateOf(page, 2)).toHaveValue("timeline");

    // Leaving by an in-app link at once: the change is sent on the way out.
    await templateOf(page, 3).selectOption("keyTerm");
    await page.getByRole("link", { name: "← Script" }).click();
    await expect(page).toHaveURL(new RegExp(`/projects/${id}/script$`));
    await expect
      .poll(async () => (await project(page, id)).draft.spec.scenes[2]!.template, {
        timeout: 15_000,
      })
      .toBe("keyTerm");
    // Back on the storyboard: it's saved, so nothing is offered (F22 QA).
    await page.goto(`/projects/${id}/storyboard`);
    await expect(templateOf(page, 3)).toHaveValue("keyTerm");
    await page.waitForTimeout(1_000);
    await expect(page.getByText(/^There are unsaved changes to this video/)).toBeHidden();
  });

  test("a slow save never conflicts with the tab's own next one (F22 QA)", async ({ page }) => {
    test.setTimeout(150_000);
    const id = await videoWithStoryboard(page, "autosave-slow", "How wind turbines work");
    // Every draft save takes 4 s to arrive.
    await page.route(`**/api/v1/projects/${id}/draft`, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 4_000));
      await route.continue();
    });
    await templateOf(page, 2).selectOption("timeline");
    await page.waitForTimeout(2_000);
    await templateOf(page, 3).selectOption("keyTerm");
    await expect
      .poll(async () => (await project(page, id)).draft.spec.scenes[2]!.template, {
        timeout: 30_000,
      })
      .toBe("keyTerm");
    const saved = await project(page, id);
    expect(saved.draft.spec.scenes[1]!.template).toBe("timeline");
    await expect(page.getByText(/^This video changed in another place\./)).toBeHidden();
    await page.unroute(`**/api/v1/projects/${id}/draft`);
  });

  test("another tab's refused change is offered, never applied (F22 QA)", async ({
    page,
    context,
  }) => {
    test.setTimeout(150_000);
    const id = await videoWithStoryboard(page, "autosave-kept", "How lighthouses work");
    const second = await context.newPage();
    await second.goto(`/projects/${id}/storyboard`);
    await hideNextDevTools(second);
    await second.getByRole("button", { name: "Take over editing" }).click();
    await expect(templateOf(second, 2)).toBeEnabled();
    // The first tab's change is refused (it lost the lease) and stays kept in the browser.
    await templateOf(page, 4).selectOption("quiz");
    await expect(page.getByText("You have this video open in another tab.")).toBeVisible({
      timeout: 15_000,
    });

    // The holder reloads: the other tab's change is offered, not applied.
    await second.reload();
    await expect(second.getByText(/^There are unsaved changes to this video/)).toBeVisible();
    await expect(templateOf(second, 4)).not.toHaveValue("quiz");
    await second.waitForTimeout(2_500);
    expect((await project(second, id)).draft.spec.scenes[3]!.template).not.toBe("quiz");
    await second.getByRole("button", { name: "Discard them" }).click();
    await second.reload();
    await expect(second.getByText(/^There are unsaved changes to this video/)).toBeHidden();
  });

  test("an editor setting changed offline is saved on reconnecting", async ({ page, context }) => {
    test.setTimeout(180_000);
    const id = await videoWithStoryboard(page, "autosave-editor", "How UPI moves your money");
    await page.getByRole("button", { name: "Generate video" }).filter({ visible: true }).click();
    await expect(page).toHaveURL(new RegExp(`/projects/${id}$`), { timeout: 90_000 });
    await hideNextDevTools(page);
    await expect(page.getByTestId("preview")).toBeVisible();

    await context.setOffline(true);
    await page.getByRole("radio", { name: "Paper" }).click();
    await expect(page.getByText(/^Offline – changes kept locally/)).toBeVisible();
    await expect(page.getByRole("radio", { name: "Paper" })).toHaveAttribute(
      "aria-checked",
      "true",
    );

    await context.setOffline(false);
    await expect(page.getByText(/^Saved · version 1/)).toBeVisible({ timeout: 20_000 });
    expect((await project(page, id)).draft.spec.theme.palette).toBe("paper");
  });
});
