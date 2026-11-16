// F14: step 1 of making a video, with the stub AI and the Inngest Dev Server. New video fills
// the idea and settings, suggests angles (creating the project), picks one, survives a reload
// and lands on step 2. Also: the edit lease, the API's checks, and the phone layout.
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { hideNextDevTools, signUpReady } from "./helpers";

const angleGroup = (page: Page) => page.getByRole("group", { name: "Angles" });

test.describe("step 1 on desktop", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Desktop layout");
  });

  test("fills step 1, gets angles, picks one, keeps it all after a reload and moves on", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await signUpReady(page, "create-idea");
    await page.goto("/projects/new");
    await hideNextDevTools(page);
    await expect(page.getByRole("heading", { level: 1, name: "New video" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Steps to make a video" })).toBeVisible();

    await page.getByLabel("Topic").fill("How a UPI payment moves money, for first-time users");
    await expect(page.getByText("51 of 500 characters")).toBeVisible();
    await page.getByLabel("Notes (optional)").fill("NPCI routes every payment.");
    await page.getByRole("button", { name: "Story" }).click();
    await page.getByRole("radio", { name: "90 s" }).click();
    await page.getByRole("radio", { name: "Male", exact: true }).click();
    await page.getByRole("radio", { name: "16:9" }).click();
    await page.getByLabel("Tone").selectOption("energetic");
    await page.getByLabel("Audience").selectOption("expert");

    await page.getByRole("button", { name: "Suggest angles" }).click();
    await expect(page).toHaveURL(/\/projects\/[0-9a-f]{24}\/idea$/);
    const angles = angleGroup(page).getByRole("radio");
    await expect(angles).toHaveCount(4, { timeout: 30_000 });
    await expect(page.getByText("4 suggestions · or write from the topic")).toBeVisible();
    await expect(page.getByText("AI requests for this video: 1 of 50")).toBeVisible();

    await angleGroup(page).getByText("Three myths, cleared up").click();
    await expect(angles.nth(1)).toBeChecked();

    // Everything was saved as it changed.
    await page.waitForTimeout(1200);
    await page.reload();
    await expect(page.getByLabel("Topic")).toHaveValue(
      "How a UPI payment moves money, for first-time users",
    );
    await expect(page.getByLabel("Notes (optional)")).toHaveValue("NPCI routes every payment.");
    await expect(page.getByRole("button", { name: "Story" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.getByRole("radio", { name: "90 s" })).toBeChecked();
    await expect(page.getByRole("radio", { name: "Male", exact: true })).toBeChecked();
    await expect(page.getByRole("radio", { name: "16:9" })).toBeChecked();
    await expect(page.getByLabel("Tone")).toHaveValue("energetic");
    await expect(page.getByLabel("Audience")).toHaveValue("expert");
    await expect(angleGroup(page).getByRole("radio").nth(1)).toBeChecked();

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);

    // Fresh angles replace the old ones and clear the pick; that's a second AI request.
    const again = page.getByRole("button", { name: "Suggest new angles" });
    await expect(again).toBeEnabled();
    await again.click();
    await expect(page.getByText("AI requests for this video: 2 of 50")).toBeVisible();
    // Done when Suggest works again; by then the new angles are in and nothing is picked.
    await expect(again).toBeEnabled({ timeout: 30_000 });
    await expect(angleGroup(page).getByRole("radio")).toHaveCount(4);
    await expect(angleGroup(page).getByRole("radio", { checked: true })).toHaveCount(0);
    await angleGroup(page).getByText("One person's story").click();

    await page.getByRole("button", { name: "Write the script" }).click();
    await expect(page).toHaveURL(/\/projects\/[0-9a-f]{24}\/script$/);
  });

  test("a second tab opens read-only and can take over", async ({ page, context }) => {
    test.setTimeout(60_000);
    await signUpReady(page, "create-lease");
    await page.goto("/library");
    await page.getByLabel("Describe your video").fill("Why the sky is blue");
    await page.getByRole("button", { name: "Generate video" }).click();
    await expect(page).toHaveURL(/\/idea$/);
    await expect(page.getByRole("button", { name: "Suggest angles" })).toBeEnabled();

    const other = await context.newPage();
    await other.goto(page.url());
    await expect(other.getByText("You have this video open in another tab.")).toBeVisible();
    await expect(other.getByRole("button", { name: "Suggest angles" })).toBeDisabled();
    await other.getByRole("button", { name: "Edit here instead" }).click();
    await expect(other.getByText("You have this video open in another tab.")).toBeHidden();
    await expect(other.getByRole("button", { name: "Suggest angles" })).toBeEnabled();
    await other.close();
  });

  test("write from the topic: New video makes the project, starts its script and opens step 2", async ({
    page,
  }) => {
    await signUpReady(page, "create-skip");
    await page.goto("/projects/new");
    await page.getByLabel("Topic").fill("My own idea about monsoon farming");
    await page.getByRole("button", { name: "Write the script from the topic" }).click();
    await expect(page).toHaveURL(/\/projects\/[0-9a-f]{24}\/script$/);
    const id = /projects\/([0-9a-f]{24})/.exec(page.url())![1];
    const project = await (await page.request.get(`/api/v1/projects/${id}`)).json();
    expect(project.idea.topic).toBe("My own idea about monsoon farming");
    // No angles were suggested: the one AI request is the script (F15).
    expect(project.counters.generationsUsed).toBe(1);
    const jobs = await (await page.request.get(`/api/v1/jobs?projectId=${id}`)).json();
    expect(jobs.items.map((job: { type: string }) => job.type)).toEqual(["script"]);
  });

  test("a refused edit stops Suggest: no job, no AI request, focus on the field", async ({
    page,
  }) => {
    await signUpReady(page, "create-refused");
    await page.goto("/library");
    await page.getByLabel("Describe your video").fill("Rainwater harvesting at home");
    await page.getByRole("button", { name: "Generate video" }).click();
    await expect(page).toHaveURL(/\/idea$/);
    const id = /projects\/([0-9a-f]{24})/.exec(page.url())![1];
    const notes = page.getByLabel("Notes (optional)");
    await notes.fill("Also nsfw content.");
    await expect(page.getByText("Videos can't contain sexual content.")).toBeVisible();

    await page.getByRole("button", { name: "Suggest angles" }).click();
    await expect(notes).toBeFocused();
    // No ideas progress in the angles section (the sidebar's usage meter is a progress bar too).
    await expect(
      page.getByRole("region", { name: "Pick an angle" }).getByRole("progressbar"),
    ).toHaveCount(0);
    const project = await (await page.request.get(`/api/v1/projects/${id}`)).json();
    expect(project.counters.generationsUsed).toBe(0);
    expect(project.idea.notes).toBeNull();
  });

  test("a read-only tab can still open step 2, without changing anything", async ({
    page,
    context,
  }) => {
    await signUpReady(page, "create-readonly");
    await page.goto("/library");
    await page.getByLabel("Describe your video").fill("How solar panels work");
    await page.getByRole("button", { name: "Generate video" }).click();
    await expect(page).toHaveURL(/\/idea$/);
    await expect(page.getByRole("button", { name: "Suggest angles" })).toBeEnabled();

    const other = await context.newPage();
    await other.goto(page.url());
    await expect(other.getByText("You have this video open in another tab.")).toBeVisible();
    await other.getByRole("button", { name: "Write the script from the topic" }).click();
    await expect(other).toHaveURL(/\/script$/);
    await other.close();
  });

  test("the ideas API needs the editor tab and a key, and refuses another tab's lease", async ({
    page,
  }) => {
    await signUpReady(page, "create-api");
    const origin = new URL(page.url()).origin;
    const created = await page.request.post("/api/v1/projects", {
      headers: { Origin: origin, "Idempotency-Key": crypto.randomUUID() },
      data: { topic: "How tides work" },
    });
    const { id } = await created.json();
    const ideas = (headers: Record<string, string>, data: unknown = {}) =>
      page.request.post(`/api/v1/projects/${id}/ideas`, {
        headers: { Origin: origin, "Idempotency-Key": crypto.randomUUID(), ...headers },
        data,
      });

    expect((await ideas({})).status()).toBe(400); // no X-Editor-Id
    expect((await ideas({ "X-Editor-Id": "tab-a" }, { count: 7 })).status()).toBe(400);
    await page.request.post(`/api/v1/projects/${id}/lease`, {
      headers: { Origin: origin, "X-Editor-Id": "tab-a" },
      data: {},
    });
    const elsewhere = await ideas({ "X-Editor-Id": "tab-b" });
    expect(elsewhere.status()).toBe(423);
    expect((await elsewhere.json()).error.code).toBe("LEASE_HELD");

    const started = await ideas({ "X-Editor-Id": "tab-a" }, { count: 3 });
    expect(started.status()).toBe(202);
    expect(await started.json()).toMatchObject({ type: "ideas", projectId: id });
    const again = await ideas({ "X-Editor-Id": "tab-a" });
    expect(again.status()).toBe(409);
    expect((await again.json()).error.code).toBe("JOB_IN_PROGRESS");
    const project = await (await page.request.get(`/api/v1/projects/${id}`)).json();
    expect(project.counters.generationsUsed).toBe(1);
  });
});

test.describe("step 1 on a phone", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "Phone layout");
  });

  test("is a full screen with settings rows and a bottom button", async ({ page }) => {
    test.setTimeout(90_000);
    await signUpReady(page, "create-mobile");
    await page.goto("/projects/new");
    await hideNextDevTools(page);
    await expect(page.getByText("Step 1 of 4 · Idea")).toBeVisible();
    await expect(page.getByRole("navigation", { name: "App" })).toHaveCount(0);

    await page.getByLabel("Topic").fill("Photosynthesis for class 6");
    await page.getByRole("button", { name: /Length/ }).click();
    await page.getByRole("radio", { name: "30 s" }).click();
    await expect(page.getByRole("button", { name: /Length\s*30 s/ })).toBeVisible();

    await page.getByRole("button", { name: "Suggest angles" }).click();
    await expect(page).toHaveURL(/\/idea$/);
    await expect(angleGroup(page).getByRole("radio")).toHaveCount(4, { timeout: 30_000 });
    await angleGroup(page).getByText("One person's story").click();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflow).toBe(false);
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);

    await page.getByRole("button", { name: "Write the script" }).click();
    await expect(page).toHaveURL(/\/script$/);
  });
});
