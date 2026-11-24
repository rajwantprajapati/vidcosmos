// F17: step 3 of making a video, with the stub AI and the Inngest Dev Server. Step 2's "Build
// the storyboard" builds the scenes; a template change and an edit save with the draft's rev;
// a trigger the narrator never says marks its scene, names it in the banner and blocks
// Generate; editing the narration fixes it and changes the script; rebuilding asks first.
// Also: the API's checks, and the phone layout with the full-screen scene editor.
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { hideNextDevTools, signUpReady } from "./helpers";

/** A new video with its script written and its storyboard built, on step 3. */
async function videoWithStoryboard(page: Page, label: string, topic: string) {
  await signUpReady(page, label);
  await page.goto("/projects/new");
  await hideNextDevTools(page);
  await page.getByLabel("Topic").fill(topic);
  await page.getByRole("button", { name: /^Write (the script )?from the topic$/ }).click();
  await expect(page).toHaveURL(/\/projects\/[0-9a-f]{24}\/script$/);
  await expect(page.getByLabel("Script text")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Build the storyboard" }).last().click();
  await expect(page).toHaveURL(/\/projects\/[0-9a-f]{24}\/storyboard$/);
  await expect(page.getByText(/^\d+ scenes · about \d+ s/).filter({ visible: true })).toBeVisible({
    timeout: 30_000,
  });
  return /projects\/([0-9a-f]{24})/.exec(page.url())![1]!;
}

const project = async (page: Page, id: string) =>
  (await page.request.get(`/api/v1/projects/${id}`)).json();

test.describe("step 3 on desktop", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Desktop layout");
  });

  test("builds, edits, flags a bad trigger, fixes it and rebuilds", async ({ page }) => {
    test.setTimeout(120_000);
    const id = await videoWithStoryboard(page, "storyboard-flow", "How solar panels work");
    await expect(page.getByRole("navigation", { name: "Steps to make a video" })).toBeVisible();
    const generate = page.getByRole("button", { name: "Generate video" });
    await expect(generate).toBeEnabled();
    await expect(
      page.getByText(/^Generating uses 1 of your \d+ videos this month\. You have \d+ left\.$/),
    ).toBeVisible();
    const built = await project(page, id);
    expect(built.wizardStep).toBe("storyboard");
    expect(built.stale.storyboard).toBe(false);
    const scenes = built.draft.spec.scenes as { id: string; template: string }[];
    expect(scenes.length).toBeGreaterThanOrEqual(5);
    expect(scenes[0]!.template).toBe("title");

    // Each card highlights the words its elements appear on.
    const first = page.getByRole("listitem", { name: "Scene 1" });
    await expect(first.locator("mark").first()).toBeVisible();
    expect(await new AxeBuilder({ page }).analyze()).toHaveProperty("violations", []);

    // A template change is saved with the draft's rev and survives a reload.
    const second = page.getByRole("listitem", { name: "Scene 2" });
    await second.getByLabel("Template").selectOption("timeline");
    await expect(page.getByText("Saved just now")).toBeVisible({ timeout: 10_000 });
    await page.reload();
    await expect(
      page.getByRole("listitem", { name: "Scene 2" }).getByLabel("Template"),
    ).toHaveValue("timeline");
    const afterSwitch = await project(page, id);
    expect(afterSwitch.draft.rev).toBe(built.draft.rev + 1);
    expect(afterSwitch.draft.spec.scenes[1].userEdited).toBe(true);

    // A trigger the narrator never says: the banner names the scene and Generate waits.
    await page.getByRole("button", { name: "Edit scene 1" }).click();
    const editor = page.getByRole("dialog", { name: "Scene 1" });
    await editor.getByLabel("Appears on").first().fill("secure");
    await expect(
      editor.getByText(/“secure” isn’t in this scene’s narration|"secure" isn't/),
    ).toBeVisible();
    await editor.getByRole("button", { name: "Done" }).click();
    await expect(page.getByText("Scene 1 needs a fix.")).toBeVisible();
    await expect(
      page.getByText(/waits for the words “secure”, but the narrator never says them/),
    ).toBeVisible();
    await expect(page.getByRole("listitem", { name: "Scene 1, needs a fix" })).toBeVisible();
    await expect(generate).toBeDisabled();
    await expect(
      page.getByText("Fix the scenes marked above to generate the video."),
    ).toBeVisible();
    // Saved anyway, so nothing typed is lost.
    await expect(page.getByText("Saved just now")).toBeVisible({ timeout: 10_000 });
    await expect
      .poll(async () => (await project(page, id)).draft.spec.scenes[0].content.headingTrigger)
      .toBe("secure");

    // Saying the word fixes it, and the script follows the narration (PRD FR-3.5).
    await page.getByRole("button", { name: "Edit scene 1" }).click();
    const narration = editor.getByLabel("Narration");
    await narration.fill(`${await narration.inputValue()} It stays secure.`);
    await editor.getByRole("button", { name: "Done" }).click();
    await expect(page.getByText("Scene 1 needs a fix.")).toBeHidden();
    await expect(generate).toBeEnabled();
    await expect
      .poll(async () => (await project(page, id)).script.text as string, { timeout: 10_000 })
      .toContain("It stays secure.");
    const synced = await project(page, id);
    expect(synced.script.source).toBe("ai_edited");
    expect(synced.stale.storyboard).toBe(false);

    // Rebuilding asks first, then replaces the scenes.
    await page.getByRole("button", { name: "Rebuild storyboard" }).first().click();
    const confirm = page.getByRole("dialog", { name: "Rebuild the storyboard?" });
    await expect(confirm).toContainText("with the changes you made to them");
    await confirm.getByRole("button", { name: "Keep these scenes" }).click();
    await expect(confirm).toBeHidden();
    await page.getByRole("button", { name: "Rebuild storyboard" }).first().click();
    await confirm.getByRole("button", { name: "Rebuild storyboard" }).click();
    await expect
      .poll(async () => (await project(page, id)).draft.spec.scenes[1].userEdited, {
        timeout: 30_000,
      })
      .toBe(false);
    await expect(
      page.getByRole("listitem", { name: "Scene 2" }).getByLabel("Template"),
    ).not.toHaveValue("timeline");

    // Generate records the video (F20) and opens the editor once it's ready.
    await generate.click();
    await expect(page).toHaveURL(new RegExp(`/projects/${id}(/generating)?$`));
  });

  test("a script changed after the storyboard shows it as stale", async ({ page }) => {
    test.setTimeout(90_000);
    const id = await videoWithStoryboard(page, "storyboard-stale", "How rainbows form");
    const tab = { "X-Editor-Id": "another-tab", Origin: new URL(page.url()).origin };
    await page.request.post(`/api/v1/projects/${id}/lease`, {
      data: { takeover: true },
      headers: tab,
    });
    const before = await project(page, id);
    await page.request.patch(`/api/v1/projects/${id}`, {
      data: { script: { text: `${before.script.text} One more line.` } },
      headers: tab,
    });
    await page.goto(`/projects/${id}/storyboard`);
    await page.getByRole("button", { name: "Take over editing" }).click();
    await expect(page.getByText("The script changed after these scenes were made.")).toBeVisible();
  });
});

test.describe("storyboard API", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "One run is enough");
  });

  test("needs a script, asks before replacing a storyboard, and checks triggers on save", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await signUpReady(page, "storyboard-api");
    const created = await (
      await page.request.post("/api/v1/projects", {
        data: { topic: "How tides work" },
        headers: { "Idempotency-Key": crypto.randomUUID(), Origin: new URL(page.url()).origin },
      })
    ).json();
    const path = `/api/v1/projects/${created.id}`;
    const tab = { "X-Editor-Id": "tab-api", Origin: new URL(page.url()).origin };
    const ask = (body: object = {}) =>
      page.request.post(`${path}/storyboard`, {
        data: body,
        headers: { ...tab, "Idempotency-Key": crypto.randomUUID() },
      });

    const noScript = await ask();
    expect(noScript.status()).toBe(409);
    expect((await noScript.json()).error).toMatchObject({
      code: "STAGE_INVALID",
      details: { needs: "script" },
    });

    // A script, then a storyboard.
    const script = await page.request.post(`${path}/script`, {
      data: {},
      headers: { ...tab, "Idempotency-Key": crypto.randomUUID() },
    });
    expect(script.status()).toBe(202);
    await expect
      .poll(async () => (await (await page.request.get(path)).json()).script !== null, {
        timeout: 30_000,
      })
      .toBe(true);
    const job = await ask();
    expect(job.status()).toBe(202);
    expect((await job.json()).type).toBe("storyboard");
    await expect
      .poll(async () => (await (await page.request.get(path)).json()).draft.spec !== null, {
        timeout: 30_000,
      })
      .toBe(true);

    const again = await ask();
    expect(again.status()).toBe(409);
    expect((await again.json()).error.details).toMatchObject({ needs: "overwrite" });

    // A trigger the narrator never says is saved, and comes back as an issue.
    const detail = await (await page.request.get(path)).json();
    const spec = detail.draft.spec;
    spec.scenes[0].content.headingTrigger = "never said";
    const saved = await page.request.put(`${path}/draft`, {
      data: { baseRev: detail.draft.rev, spec },
      headers: tab,
    });
    expect(saved.status()).toBe(200);
    expect((await saved.json()).issues).toEqual([
      expect.objectContaining({
        code: "TRIGGER_NOT_IN_NARRATION",
        sceneId: spec.scenes[0].id,
        path: "headingTrigger",
      }),
    ]);
    // Text over its limit is a shape error: nothing is saved.
    spec.scenes[0].content.heading = "x".repeat(61);
    const tooLong = await page.request.put(`${path}/draft`, {
      data: { baseRev: detail.draft.rev + 1, spec },
      headers: tab,
    });
    expect(tooLong.status()).toBe(400);

    // What an edit adds is moderated, like a script edit: nothing is saved.
    const current = await (await page.request.get(path)).json();
    const blocked = structuredClone(current.draft.spec);
    blocked.scenes[1].narration = `${blocked.scenes[1].narration} Here is how to build a bomb at home.`;
    const refused = await page.request.put(`${path}/draft`, {
      data: { baseRev: current.draft.rev, spec: blocked },
      headers: tab,
    });
    expect(refused.status()).toBe(422);
    expect((await refused.json()).error.code).toBe("CONTENT_BLOCKED");
    const unchanged = await (await page.request.get(path)).json();
    expect(unchanged.draft.rev).toBe(current.draft.rev);
    expect(unchanged.script.text).not.toContain("bomb");

    // The settings own the language, narrator, format, theme and music, whatever is sent.
    const forged = {
      ...current.draft.spec,
      language: "hi",
      format: "16:9",
      voice: { ...current.draft.spec.voice, voiceId: "attacker-chosen-voice", speed: 1.15 },
      music: { trackId: "any-track", volume: 1, duck: false },
    };
    const kept = await page.request.put(`${path}/draft`, {
      data: { baseRev: current.draft.rev, spec: forged },
      headers: tab,
    });
    expect(kept.status()).toBe(200);
    const after = (await (await page.request.get(path)).json()).draft.spec;
    expect(after).toMatchObject({
      language: current.settings.language,
      format: current.settings.format,
      voice: { voiceId: current.draft.spec.voice.voiceId, speed: current.settings.voiceSpeed },
      music: null,
    });

    // Narration far over the length: an issue before any narration is recorded.
    const long = structuredClone(after);
    // Short words: many seconds of speech within the script's 1,800 characters.
    const filler = " yes".repeat(30);
    for (const scene of long.scenes) scene.narration = `${scene.narration}${filler}`.slice(0, 400);
    const tooMuch = await page.request.put(`${path}/draft`, {
      data: { baseRev: current.draft.rev + 1, spec: long },
      headers: tab,
    });
    expect(tooMuch.status()).toBe(200);
    expect((await tooMuch.json()).issues).toContainEqual(
      expect.objectContaining({ code: "DURATION_OUT_OF_RANGE", sceneId: null }),
    );
  });
});

test.describe("step 3 on a phone", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "Phone layout");
  });

  test("lists the scenes, edits one full screen, and keeps Generate at the bottom", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await videoWithStoryboard(page, "storyboard-phone", "How a bicycle balances");
    await expect(page.getByText("Step 3 of 4")).toBeVisible();
    await expect(
      page.getByText(/^\d+ scenes · about \d+ s · tap a scene to edit it$/),
    ).toBeVisible();
    const generate = page.getByRole("button", { name: "Generate video" });
    await expect(generate).toBeInViewport();
    await expect(page.getByText(/^Uses 1 of your \d+ videos this month · \d+ left$/)).toBeVisible();

    await page.getByRole("button", { name: /^Scene 1 · Title/ }).click();
    const editor = page.getByRole("dialog", { name: "Scene 1" });
    await expect(editor).toBeVisible();
    const box = await editor.boundingBox();
    expect(box?.width).toBe(390);
    await editor.getByLabel("Appears on").first().fill("secure");
    await editor.getByRole("button", { name: "Done" }).click();
    await expect(page.getByText("Scene 1 needs a fix.")).toBeVisible();
    await expect(page.getByText("Tap it to see what’s wrong.")).toBeVisible();
    await expect(generate).toBeDisabled();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflow).toBe(false);
    expect(await new AxeBuilder({ page }).analyze()).toHaveProperty("violations", []);
  });
});
