// F10: usage and limits, read side. GET /me and /usage, the meters, and the limit-reached state.
import { expect, type Page, test } from "@playwright/test";
import { meDto, usageDto } from "@vidcosmos/spec/api";
import { setVideosUsed } from "./database";
import { hideNextDevTools, signUpReady } from "./helpers";

test.beforeEach(async ({ page }) => {
  await hideNextDevTools(page);
});

async function createProject(page: Page, topic: string) {
  const origin = new URL(page.url()).origin;
  const response = await page.request.post("/api/v1/projects", {
    data: { topic },
    headers: { Origin: origin, "Idempotency-Key": crypto.randomUUID() },
  });
  expect(response.status()).toBe(201);
}

test.describe("usage", () => {
  test("GET /me and /usage return the usage block", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "API: one run is enough");
    const email = await signUpReady(page, "usage-api");
    setVideosUsed(email, 7, 1);

    const usage = usageDto.parse(await (await page.request.get("/api/v1/usage")).json());
    expect(usage.videos).toEqual({ used: 7, reserved: 1, max: 20 });
    expect(usage.period.key).toMatch(/^\d{4}-\d{2}$/);
    expect(usage.concurrentJobs).toEqual({ active: 0, max: 2 });

    const me = meDto.parse(await (await page.request.get("/api/v1/me")).json());
    expect(me.usage).toEqual(usage);
    expect(me.user.email).toBe(email);
  });

  test("the sidebar and Settings show used of limit and the reset date", async ({
    page,
  }, testInfo) => {
    const email = await signUpReady(page, "usage-meters");
    setVideosUsed(email, 12);
    await page.goto("/settings");
    const card = page.getByRole("region", { name: "Usage" });
    await expect(card.getByText("Videos this month")).toBeVisible();
    await expect(card.getByText(/^of 20 · resets \d{1,2} [A-Z][a-z]{2}$/)).toBeVisible();
    await expect(card.getByRole("progressbar", { name: "Videos this month" })).toHaveAttribute(
      "aria-valuenow",
      "12",
    );
    await expect(card.getByText("Exports today")).toBeVisible();
    await expect(
      card.getByText("Up to 2 videos can be generating or exporting at the same time."),
    ).toBeVisible();
    if (testInfo.project.name === "desktop") {
      const sidebar = page.getByRole("complementary", { name: "App" });
      await expect(sidebar.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "12");
    }
  });

  test("a workspace at its limit sees the limit state; its videos stay open", async ({
    page,
  }, testInfo) => {
    const email = await signUpReady(page, "usage-limit");
    await createProject(page, "How UPI moves money");
    setVideosUsed(email, 19, 1); // a reserved video counts as taken
    await page.goto("/library");

    await expect(
      page.getByRole("status").filter({ hasText: "You’ve used all 20 videos this month." }),
    ).toContainText(/You can make new videos again on \d{1,2} [A-Z][a-z]{2}\./);
    if (testInfo.project.name === "desktop") {
      await expect(page.getByRole("button", { name: "Generate video" })).toBeDisabled();
    } else {
      await expect(page.getByRole("link", { name: /Start a new video/ })).toHaveAttribute(
        "aria-disabled",
        "true",
      );
    }
    // Existing videos still open.
    await page.getByRole("link", { name: /How UPI moves money/ }).click();
    await expect(page).toHaveURL(/\/projects\/[0-9a-f]{24}\/idea$/);

    // Back under the limit, Generate works again.
    setVideosUsed(email, 5);
    await page.goto("/library");
    await expect(page.getByText("You’ve used all 20 videos this month.")).toHaveCount(0);
    if (testInfo.project.name === "desktop") {
      await expect(page.getByRole("button", { name: "Generate video" })).toBeEnabled();
    }
  });

  test("the meters count reserved videos, like the notice", async ({ page }, testInfo) => {
    const email = await signUpReady(page, "usage-reserved");
    setVideosUsed(email, 19, 1);
    await page.goto("/settings");
    const card = page.getByRole("region", { name: "Usage" });
    await expect(card.getByRole("progressbar", { name: "Videos this month" })).toHaveAttribute(
      "aria-valuenow",
      "20",
    );
    if (testInfo.project.name === "desktop") {
      const sidebar = page.getByRole("complementary", { name: "App" });
      await expect(sidebar.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "20");
    }
    // 15 used + 1 generating is 80%: the meter turns warning.
    setVideosUsed(email, 15, 1);
    await page.reload();
    const bar = card.getByRole("progressbar", { name: "Videos this month" });
    await expect(bar).toHaveAttribute("aria-valuenow", "16");
    await expect(bar.locator("> div")).toHaveClass(/bg-warning/);
  });

  test("New video also says when the allowance is used up", async ({ page }) => {
    const email = await signUpReady(page, "usage-new");
    setVideosUsed(email, 20);
    await page.goto("/projects/new");
    await expect(page.getByText("You’ve used all 20 videos this month.")).toBeVisible();
  });

  test("a new account at its limit sees it in the empty state", async ({ page }) => {
    const email = await signUpReady(page, "usage-empty");
    setVideosUsed(email, 20);
    await page.goto("/library");
    await expect(page.getByRole("heading", { name: "Make your first video" })).toBeVisible();
    await expect(page.getByText("You’ve used all 20 videos this month.")).toBeVisible();
  });
});
