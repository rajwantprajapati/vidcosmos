import { expect, test } from "@playwright/test";

test("placeholder home page renders", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("Vidcosmos");
  await expect(page.getByRole("heading", { level: 1, name: "Vidcosmos" })).toBeVisible();
  await expect(page.getByText("A universe of videos, made by AI.")).toBeVisible();
});
