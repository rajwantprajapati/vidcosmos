// F07: the app shell (sidebar on desktop, top bar and tab bar on phones) and the placeholder
// for every route in the route map.
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { hideNextDevTools, signUpReady } from "./helpers";

const projectId = "6740a1b2c3d4e5f601234567";

const routes: [path: string, heading: string][] = [
  ["/library", "Your library"],
  ["/posts", "Posts"],
  ["/settings", "Settings"],
  ["/projects/new", "New video"],
  [`/projects/${projectId}`, "Editor"],
  [`/projects/${projectId}/idea`, "Idea"],
  [`/projects/${projectId}/script`, "Script"],
  [`/projects/${projectId}/storyboard`, "Storyboard"],
  [`/projects/${projectId}/generating`, "Generating"],
  [`/projects/${projectId}/export`, "Export and post"],
];

test.describe("app shell", () => {
  test.beforeEach(async ({ page }) => {
    await hideNextDevTools(page);
    await signUpReady(page, "shell", "Asha Rao");
  });

  test("every route in the route map loads its placeholder", async ({ page }) => {
    for (const [path, heading] of routes) {
      const response = await page.goto(path);
      expect(response?.status(), path).toBe(200);
      await expect(page.getByRole("heading", { level: 1, name: heading }), path).toBeVisible();
    }
  });

  test("a 404 inside the app is styled, titled and marks no section", async ({ page }) => {
    for (const path of ["/projects/not-an-id/script", "/projects/new/idea"]) {
      const response = await page.goto(path);
      expect(response?.status(), path).toBe(404);
      await expect(page.getByRole("heading", { level: 1, name: "Page not found" })).toBeVisible();
      await expect(page).toHaveTitle("Page not found · Vidcosmos");
      await expect(page.locator('a[aria-current="page"]:visible'), path).toHaveCount(0);
    }
    await page.getByRole("link", { name: "Go to your library" }).click();
    await expect(page).toHaveURL(/\/library$/);
  });

  test("an address that matches nothing gets the same page", async ({ page }) => {
    const response = await page.goto("/nonexistent");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1, name: "Page not found" })).toBeVisible();
    await expect(page).toHaveTitle("Page not found · Vidcosmos");
  });

  test("/admin is a 404 for people who aren't admins", async ({ page }) => {
    const response = await page.goto("/admin");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1, name: "Page not found" })).toBeVisible();
    await expect(page).toHaveTitle("Page not found · Vidcosmos");
  });

  test("desktop: the sidebar has New video, the sections, usage and the profile", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "sidebar is desktop only");
    await page.goto("/library");
    const sidebar = page.getByRole("complementary", { name: "App" });
    await expect(sidebar).toBeVisible();
    await expect(sidebar.getByRole("link", { name: "New video" })).toHaveAttribute(
      "href",
      "/projects/new",
    );
    const sections = sidebar.getByRole("navigation", { name: "Sections" });
    await expect(sections.getByRole("link")).toHaveText(["Library", "Posts", "Settings"]);
    await expect(sections.getByRole("link", { name: "Library" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(sidebar.getByText("Videos this month")).toBeVisible();
    await expect(sidebar.getByText(/of 20 · resets \d{1,2} \w{3}/)).toBeVisible();
    await expect(sidebar.getByText("Asha", { exact: true })).toBeVisible();
    await expect(sidebar.getByText("Free beta")).toBeVisible();
    await expect(page.getByRole("navigation", { name: "App" })).toBeHidden();

    await sections.getByRole("link", { name: "Posts" }).click();
    await expect(page).toHaveURL(/\/posts$/);
    await expect(sections.getByRole("link", { name: "Posts" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(sections.getByRole("link", { name: "Library" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  test("phone: the tab bar replaces the sidebar", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "tab bar is for phones");
    await page.goto("/library");
    await expect(page.getByRole("complementary", { name: "App" })).toBeHidden();
    const tabs = page.getByRole("navigation", { name: "App" });
    await expect(tabs).toBeVisible();
    await expect(tabs.getByRole("link")).toHaveText(["Library", "New video", "Posts", "Settings"]);
    await expect(tabs.getByRole("link", { name: "Library" })).toHaveAttribute(
      "aria-current",
      "page",
    );

    // The bar sits at the bottom of the screen and stays there.
    const box = await tabs.boundingBox();
    expect(Math.round((box?.y ?? 0) + (box?.height ?? 0))).toBe(page.viewportSize()?.height);

    await tabs.getByRole("link", { name: "Settings" }).click();
    await expect(page).toHaveURL(/\/settings$/);
    await expect(tabs.getByRole("link", { name: "Settings" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await tabs.getByRole("link", { name: "New video" }).click();
    await expect(page).toHaveURL(/\/projects\/new$/);
  });

  test("project pages count as the library", async ({ page }) => {
    await page.goto(`/projects/${projectId}/script`);
    const current = page.locator('a[aria-current="page"]:visible');
    await expect(current).toHaveCount(1);
    await expect(current).toContainText("Library");
  });

  test("has no accessibility violations (axe) and no sideways scroll", async ({ page }) => {
    for (const path of ["/library", "/settings"]) {
      await page.goto(path);
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations.map((v) => `${path} ${v.id}: ${v.help}`)).toEqual([]);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, path).toBe(0);
    }
  });
});
