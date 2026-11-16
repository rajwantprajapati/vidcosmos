// F15: step 2 of making a video, with the stub AI and the Inngest Dev Server. Step 1 starts the
// script; step 2 shows it with its word count, length and fit; edits save as you type; rewrites
// change all of it or a selected part, and can be undone; a custom rewrite asks how. Editing the
// idea marks the script stale, and writing a new one over an edit asks first. Also: the over-
// length warning, the API's checks, and the phone layout.
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { hideNextDevTools, signUpReady } from "./helpers";

const scriptText = (page: Page) => page.getByLabel("Script text");

/** A new video written from its topic, with its script on screen. */
async function videoWithScript(page: Page, label: string, topic: string) {
  await signUpReady(page, label);
  await page.goto("/projects/new");
  await hideNextDevTools(page);
  await page.getByLabel("Topic").fill(topic);
  await page.getByRole("button", { name: /^Write (the script )?from the topic$/ }).click();
  await expect(page).toHaveURL(/\/projects\/[0-9a-f]{24}\/script$/);
  await expect(scriptText(page)).toBeVisible({ timeout: 30_000 });
  return /projects\/([0-9a-f]{24})/.exec(page.url())![1]!;
}

const project = async (page: Page, id: string) =>
  (await page.request.get(`/api/v1/projects/${id}`)).json();

test.describe("step 2 on desktop", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Desktop layout");
  });

  test("writes, edits, rewrites and undoes a script", async ({ page }) => {
    test.setTimeout(120_000);
    const id = await videoWithScript(page, "script-flow", "How solar panels make electricity");
    await expect(page.getByRole("navigation", { name: "Steps to make a video" })).toBeVisible();
    await expect(
      page.getByText(/^\d+ words · about \d+ s with an Indian female voice$/),
    ).toBeVisible();
    await expect(page.getByText("Fits your 60 s target")).toBeVisible();
    await expect(page.getByRole("complementary", { name: "Video details" })).toContainText(
      "60 s · 9:16",
    );
    const written = await scriptText(page).inputValue();
    expect(written).toContain("How solar panels make electricity");

    // Typing saves on its own and survives a reload.
    await scriptText(page).fill(`${written}\n\nSolar panels love the Indian sun.`);
    await expect(page.getByText("Saved just now")).toBeVisible();
    await page.reload();
    await expect(scriptText(page)).toHaveValue(/Solar panels love the Indian sun\.$/);
    expect((await project(page, id)).script.source).toBe("ai_edited");

    // A rewrite of the whole script, then undo.
    const before = await scriptText(page).inputValue();
    await page.getByRole("button", { name: "Longer" }).click();
    await expect(scriptText(page)).toHaveValue(
      /Here is one more example that makes it concrete\.$/,
      {
        timeout: 30_000,
      },
    );
    await page.getByRole("button", { name: "Undo last rewrite" }).click();
    await expect(scriptText(page)).toHaveValue(before);
    await expect(page.getByRole("button", { name: "Undo last rewrite" })).toBeHidden();

    // A selected sentence: only that part changes.
    const start = before.indexOf("Solar panels love the Indian sun.");
    await scriptText(page).evaluate(
      (element, [from, to]) => (element as HTMLTextAreaElement).setSelectionRange(from!, to!),
      [start, start + "Solar panels love the Indian sun.".length],
    );
    await page.getByRole("button", { name: "More engaging" }).click();
    await expect(scriptText(page)).toHaveValue(
      `${before.slice(0, start)}Picture this. Solar panels love the Indian sun.`,
      { timeout: 30_000 },
    );

    // Custom asks how, in a dialog.
    await page.getByRole("button", { name: "Custom…" }).click();
    const dialog = page.getByRole("dialog", { name: "Rewrite the script" });
    await dialog.getByRole("button", { name: "Rewrite" }).click();
    await expect(dialog.getByText("Say how the script should change.")).toBeVisible();
    await dialog.getByLabel("How should it change?").fill("End on a warmer note");
    await dialog.getByRole("button", { name: "Rewrite" }).click();
    await expect(scriptText(page)).toHaveValue(/That is the key idea\.$/, { timeout: 30_000 });

    // The script, Longer, More engaging and Custom: four AI requests.
    expect((await project(page, id)).counters.generationsUsed).toBe(4);
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);

    await page.getByRole("button", { name: "Build the storyboard" }).click();
    await expect(page).toHaveURL(/\/storyboard$/);
  });

  test("editing the idea marks the script stale; a new one over an edit asks first", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const id = await videoWithScript(page, "script-stale", "Why the monsoon arrives in June");
    await scriptText(page).fill("My own script about the monsoon. It arrives in June.");
    await expect(page.getByText("Saved just now")).toBeVisible();
    await expect(page.getByText("The topic, notes or angle changed")).toBeHidden();

    await page.getByRole("link", { name: "← Idea" }).click();
    await expect(page).toHaveURL(/\/idea$/);
    await page.getByLabel("Notes (optional)").fill("Kerala first, around 1 June.");
    await page.getByRole("button", { name: "Write the script from the topic" }).click();
    await expect(page).toHaveURL(/\/script$/);
    // The script was there already: nothing new was written.
    expect((await project(page, id)).counters.generationsUsed).toBe(1);
    expect((await project(page, id)).stale.script).toBe(true);
    await expect(
      page.getByText("The topic, notes or angle changed after this script was written."),
    ).toBeVisible();

    // Dismiss hides the banner for now, with focus back in the script.
    await page.getByRole("button", { name: "Dismiss" }).click();
    await expect(page.getByText("The topic, notes or angle changed")).toBeHidden();
    await expect(scriptText(page)).toBeFocused();
    await page.reload();
    await expect(page.getByText("The topic, notes or angle changed")).toBeVisible();

    await page.getByRole("button", { name: "Write a new script" }).click();
    const ask = page.getByRole("dialog", { name: "Replace your edited script?" });
    await expect(ask).toBeVisible();
    await ask.getByRole("button", { name: "Keep my script" }).click();
    await expect(ask).toBeHidden();
    await expect(scriptText(page)).toHaveValue(
      "My own script about the monsoon. It arrives in June.",
    );

    await page.getByRole("button", { name: "Write a new script" }).click();
    await ask.getByRole("button", { name: "Write a new script" }).click();
    await expect(scriptText(page)).toHaveValue(/^Let's look at Why the monsoon arrives in June/, {
      timeout: 30_000,
    });
    await expect(page.getByText("The topic, notes or angle changed")).toBeHidden();
    const after = await project(page, id);
    expect(after.stale.script).toBe(false);
    expect(after.script.source).toBe("ai");
    expect(after.counters.generationsUsed).toBe(2);
  });

  test("a script too long for the length says so and can switch to a longer video", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await videoWithScript(page, "script-long", "How tides work");
    const long = Array.from({ length: 30 }, () => "The moon pulls the sea towards it.").join(" ");
    await scriptText(page).fill(long);
    await expect(page.getByText("Longer than your 60 s target")).toBeVisible();
    await expect(page.getByRole("button", { name: "Trim to fit" })).toBeVisible();
    await page.getByRole("button", { name: "Use 90 s" }).click();
    await expect(page.getByText("Fits your 90 s target")).toBeVisible();
    await expect(page.getByRole("complementary", { name: "Video details" })).toContainText(
      "90 s · 9:16",
    );
  });

  test("a tab that lost editing stops saving and says so; the other tab's script stays", async ({
    page,
    context,
  }) => {
    test.setTimeout(90_000);
    const id = await videoWithScript(page, "script-lease", "How a pressure cooker works");
    const other = await context.newPage();
    await other.goto(page.url());
    await other.getByRole("button", { name: "Edit here instead" }).click();
    await expect(other.getByText("You have this video open in another tab.")).toBeHidden();
    await scriptText(other).fill("Tab B wrote this. It stays.");
    await expect(other.getByText("Saved just now")).toBeVisible();

    // The first tab doesn't know yet: its next save is refused and it goes read-only.
    await scriptText(page).fill("Tab A typed over it.");
    await expect(page.getByText("Another tab took over editing")).toBeVisible();
    await expect(page.getByText("You have this video open in another tab.")).toBeVisible();
    await expect(scriptText(page)).toHaveAttribute("readonly", "");
    expect((await project(page, id)).script.text).toBe("Tab B wrote this. It stays.");

    // Taking editing back shows the script as saved.
    await page.getByRole("button", { name: "Edit here instead" }).click();
    await expect(scriptText(page)).toHaveValue("Tab B wrote this. It stays.");
    await other.close();
  });

  test("a tab that learns from the lease renewal that it lost editing says its changes weren't saved", async ({
    page,
    context,
  }) => {
    test.setTimeout(90_000);
    await page.clock.install();
    await videoWithScript(page, "script-renewal", "How a ceiling fan cools a room");
    const other = await context.newPage();
    await other.goto(page.url());
    await other.getByRole("button", { name: "Edit here instead" }).click();
    await expect(other.getByText("You have this video open in another tab.")).toBeHidden();

    // Hold this tab's saves, so the renewal (every 30 s) is what finds the takeover.
    await page.route("**/api/v1/projects/*", (route) =>
      route.request().method() === "PATCH" ? new Promise(() => {}) : route.fallback(),
    );
    await scriptText(page).press("End");
    await scriptText(page).pressSequentially(" Breeze.");
    await page.clock.runFor(31_000);
    await expect(page.getByText("You have this video open in another tab.")).toBeVisible();
    await expect(page.getByText("Not saved")).toBeVisible();
    await expect(page.getByText("Another tab took over editing")).toBeVisible();
    await other.close();
  });

  test("the header stays put while saving; an empty script can't be rewritten", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await videoWithScript(
      page,
      "script-header",
      "How the Indian monsoon reaches Kerala every June and then spreads north",
    );
    const top = async () => (await scriptText(page).boundingBox())?.y;
    const before = await top();
    await scriptText(page).press("End");
    await scriptText(page).pressSequentially(" Rain.");
    await expect(page.getByText("Saving…")).toBeVisible();
    expect(await top()).toBe(before);
    await expect(page.getByText("Saved just now")).toBeVisible();
    expect(await top()).toBe(before);

    await scriptText(page).fill("   ");
    const toolbar = page.getByRole("toolbar", { name: "Rewrite the script" });
    for (const chip of ["Shorter", "Longer", "Simpler", "More engaging", "Custom…"]) {
      await expect(toolbar.getByRole("button", { name: chip })).toBeDisabled();
    }
    await expect(page.getByRole("button", { name: "Build the storyboard" })).toBeDisabled();
  });

  test("the script APIs need the editor tab, a script to rewrite and words for a custom one", async ({
    page,
  }) => {
    await signUpReady(page, "script-api");
    const origin = new URL(page.url()).origin;
    const created = await page.request.post("/api/v1/projects", {
      headers: { Origin: origin, "Idempotency-Key": crypto.randomUUID() },
      data: { topic: "How tides work" },
    });
    const { id } = await created.json();
    const post = (path: string, headers: Record<string, string>, data: unknown = {}) =>
      page.request.post(`/api/v1/projects/${id}/${path}`, {
        headers: { Origin: origin, "Idempotency-Key": crypto.randomUUID(), ...headers },
        data,
      });

    expect((await post("script", {})).status()).toBe(400); // no X-Editor-Id
    const tab = { "X-Editor-Id": "tab-a" };
    const noScript = await post("script/rewrite", tab, { instruction: "shorter" });
    expect(noScript.status()).toBe(409);
    expect((await noScript.json()).error.details.needs).toBe("script");
    expect((await post("script/rewrite", tab, { instruction: "custom" })).status()).toBe(400);
    expect((await post("script", tab, { angleId: "ang_nope" })).status()).toBe(409);

    const started = await post("script", tab);
    expect(started.status()).toBe(202);
    expect(await started.json()).toMatchObject({ type: "script", projectId: id });
    expect((await project(page, id)).counters.generationsUsed).toBe(1);
  });
});

test.describe("step 2 on a phone", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "Phone layout");
  });

  test("is a full screen with rewrite chips, the length and a bottom button", async ({ page }) => {
    test.setTimeout(90_000);
    await videoWithScript(page, "script-mobile", "Photosynthesis for class 6");
    await expect(page.getByText("Step 2 of 4")).toBeVisible();
    await expect(page.getByRole("navigation", { name: "App" })).toHaveCount(0);
    await expect(page.getByRole("toolbar", { name: "Rewrite the script" })).toBeVisible();
    await expect(page.getByText(/^\d+ words · about \d+ s$/)).toBeVisible();
    await expect(page.getByText("Fits 60 s")).toBeVisible();
    await expect(page.getByRole("complementary", { name: "Video details" })).toBeHidden();
    // Tap targets: every chip is at least 44 px tall.
    const heights = await page
      .getByRole("toolbar", { name: "Rewrite the script" })
      .getByRole("button")
      .evaluateAll((chips) => chips.map((chip) => chip.getBoundingClientRect().height));
    expect(Math.min(...heights)).toBeGreaterThanOrEqual(44);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflow).toBe(false);
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);

    await page.getByRole("button", { name: "Build the storyboard" }).click();
    await expect(page).toHaveURL(/\/storyboard$/);
  });
});
