// F21: the editor plays the generated video in the Remotion Player, with the stub voice and AI
// and the Inngest Dev Server. Seeking puts the word being said in the captions; the format,
// theme and captions change the look with no new narration; a new narrator offers to record
// the narration again. On phones, the Scenes and Style sheets.
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { hideNextDevTools, signUpReady } from "./helpers";

type Word = { text: string; startMs: number; endMs: number };
type Scene = {
  id: string;
  timing: { narrationAssetId: string; durationMs: number; leadInMs: number; words: Word[] } | null;
};
type Detail = {
  currentVersion: number | null;
  draft: { rev: number; spec: { format: string; theme: { palette: string }; scenes: Scene[] } };
  audio: Record<string, { url: string; expiresAt: string }>;
};

const project = async (page: Page, id: string): Promise<Detail> =>
  (await page.request.get(`/api/v1/projects/${id}`)).json();

const jobCount = async (page: Page, id: string): Promise<number> =>
  ((await (await page.request.get(`/api/v1/jobs?projectId=${id}`)).json()) as { items: unknown[] })
    .items.length;

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
  // Before it's generated, the editor's link opens the storyboard (F21 QA).
  await page.goto(`/projects/${id}`);
  await expect(page).toHaveURL(new RegExp(`/projects/${id}/storyboard$`));
  await expect(page.getByText(/^\d+ scenes · about \d+ s/).filter({ visible: true })).toBeVisible({
    timeout: 30_000,
  });
  await page.getByRole("button", { name: "Generate video" }).filter({ visible: true }).click();
  await expect(page).toHaveURL(new RegExp(`/projects/${id}$`), { timeout: 90_000 });
  await hideNextDevTools(page);
  await expect(page.getByTestId("preview")).toBeVisible();
  return id;
}

const frameOf = (ms: number) => Math.round((ms / 1000) * 30);

test.describe("the editor on desktop", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Desktop layout");
  });

  test("plays with captions in sync, and changes the look without new narration", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const id = await generatedVideo(page, "editor-flow", "How UPI moves your money");
    const before = await project(page, id);
    const scenes = before.draft.spec.scenes;
    expect(
      scenes.every((scene) => scene.timing && before.audio[scene.timing.narrationAssetId]),
    ).toBe(true);
    await expect(page.getByText(`Scene 1 of ${scenes.length}`)).toBeVisible();
    expect(await new AxeBuilder({ page }).analyze()).toHaveProperty("violations", []);

    // Seek to words in scene 2: the caption marks each as it's said.
    const start = frameOf(scenes[0]!.timing!.durationMs);
    const timing = scenes[1]!.timing!;
    const preview = page.getByTestId("preview");
    for (const index of [1, 4]) {
      const word = timing.words[index]!;
      await page
        .getByLabel("Seek")
        .fill(String(start + frameOf(timing.leadInMs + word.startMs + 100)));
      await expect(preview.locator("[data-spoken]")).toHaveText(word.text);
    }
    await expect(page.getByText(`Scene 2 of ${scenes.length}`)).toBeVisible();

    // Picking a scene in the list jumps to its start.
    await page.getByRole("button", { name: /^03 / }).click();
    await expect(page.getByText(`Scene 3 of ${scenes.length}`)).toBeVisible();

    // Play runs the video.
    await page.getByRole("button", { name: "Play" }).click();
    await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
    await page.getByRole("button", { name: "Pause" }).click();

    // Format, theme and captions: the player re-lays out; no job, same narration.
    const jobs = await jobCount(page, id);
    await page
      .getByRole("radiogroup", { name: "Format" })
      .getByRole("radio", { name: "16:9" })
      .click();
    await expect(preview).toHaveAttribute("data-format", "16:9");
    await expect(page.getByText(/^Saved · version 1/)).toBeVisible();
    const box = (await preview.boundingBox())!;
    expect(box.width / box.height).toBeCloseTo(16 / 9, 1);
    await page.getByRole("radio", { name: "Paper" }).click();
    await expect(page.getByText(/^Saved · version 1/)).toBeVisible();
    await page
      .getByRole("radiogroup", { name: "Captions" })
      .getByRole("radio", { name: "Off" })
      .click();
    await expect(page.getByText(/^Saved · version 1/)).toBeVisible();
    const after = await project(page, id);
    expect(after.draft.spec.format).toBe("16:9");
    expect(after.draft.spec.theme.palette).toBe("paper");
    expect(after.draft.spec.scenes.map((s) => s.timing?.narrationAssetId)).toEqual(
      scenes.map((s) => s.timing?.narrationAssetId),
    );
    expect(after.currentVersion).toBe(1);
    expect(await jobCount(page, id)).toBe(jobs);
    // Survives a reload.
    await page.reload();
    await expect(page.getByTestId("preview")).toHaveAttribute("data-format", "16:9");

    // Another tab takes over: a save is refused and the look stays as last saved, with one
    // notice; "Take over editing" takes it back (F21 QA).
    await page.request.post(`/api/v1/projects/${id}/lease`, {
      headers: { "X-Editor-Id": "another-tab", Origin: new URL(page.url()).origin },
      data: { takeover: true },
    });
    await page
      .getByRole("radiogroup", { name: "Captions" })
      .getByRole("radio", { name: "Classic" })
      .click();
    await expect(page.getByText(/open for editing in another tab/)).toBeVisible();
    await expect(page.getByText("This video is open for editing somewhere else.")).toBeHidden();
    await expect(page.getByTestId("preview")).toHaveAttribute("data-format", "16:9");
    await expect(page.getByRole("radio", { name: "Paper" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await page.getByRole("button", { name: "Take over editing" }).click();
    await expect(page.getByText(/open for editing in another tab/)).toBeHidden();
    await expect(page.getByText(/^Saved · version 1/)).toBeVisible();

    // A new narrator: every scene needs recording again, and the editor offers it.
    await page
      .getByRole("radiogroup", { name: "Narrator" })
      .getByRole("radio", { name: "Male", exact: true })
      .click();
    await expect(
      page.getByText(`${scenes.length} scenes have no narration, so they play silently.`),
    ).toBeVisible();
    await page.getByRole("button", { name: "Record narration" }).click();
    // Recorded with the new voice as version 2, then back in the editor.
    await expect
      .poll(async () => (await project(page, id)).currentVersion, { timeout: 90_000 })
      .toBe(2);
    const recorded = await project(page, id);
    expect(recorded.draft.spec.scenes.every((s) => s.timing !== null)).toBe(true);
    await expect(page).toHaveURL(new RegExp(`/projects/${id}$`), { timeout: 30_000 });
    await expect(page.getByText(/no narration, so/)).toBeHidden();
  });
});

test.describe("the editor on phones", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "Phone layout");
  });

  test("plays, jumps between scenes, and opens Scenes and Style", async ({ page }) => {
    test.setTimeout(180_000);
    const id = await generatedVideo(page, "editor-phone", "How tides work");
    const { draft } = await project(page, id);
    await expect(page.getByRole("navigation", { name: "Editor" })).toBeVisible();
    // No app sidebar, top bar or tab bar: the editor is full screen.
    await expect(page.getByRole("navigation", { name: "Sections" })).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      390,
    );
    expect(await new AxeBuilder({ page }).analyze()).toHaveProperty("violations", []);

    await page
      .getByRole("list", { name: "Scenes" })
      .getByRole("button", { name: "Scene 2" })
      .click();
    await expect(
      page.getByRole("list", { name: "Scenes" }).getByRole("button", { name: "Scene 2" }),
    ).toHaveAttribute("aria-current", "true");

    await page.getByRole("button", { name: "Style" }).click();
    const sheet = page.getByRole("dialog", { name: "Style" });
    await sheet
      .getByRole("radiogroup", { name: "Format" })
      .getByRole("radio", { name: "1:1" })
      .click();
    await expect(page.getByTestId("preview")).toHaveAttribute("data-format", "1:1");
    await sheet.getByRole("button", { name: "Done" }).click();

    await page.getByRole("button", { name: "Scenes" }).click();
    const scenes = page.getByRole("dialog", { name: /^Scenes/ });
    await expect(scenes.getByRole("button", { name: /^\d{2} / })).toHaveCount(
      draft.spec.scenes.length,
    );
    await scenes.getByRole("button", { name: /^03 / }).click();
    await expect(scenes).toBeHidden();
  });
});
