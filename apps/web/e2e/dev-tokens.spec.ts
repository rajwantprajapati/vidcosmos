import { expect, test } from "@playwright/test";

test.describe("design tokens page", () => {
  test("shows the tokens in both themes", async ({ page }) => {
    await page.goto("/dev/tokens");
    await expect(page.getByRole("heading", { level: 1, name: "Design tokens" })).toBeVisible();

    const light = page.getByTestId("panel-light");
    const dark = page.getByTestId("panel-dark");
    await expect(light.getByRole("heading", { name: "Lagoon Classic" })).toBeVisible();
    await expect(dark.getByRole("heading", { name: "Lagoon Night" })).toBeVisible();

    // The same token resolves to different colours in each theme.
    const bg = (panel: typeof light) =>
      panel.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(await bg(light)).toBe("rgb(244, 248, 247)"); // slate-50 (allow-color-literal: computed value)
    expect(await bg(dark)).toBe("rgb(10, 26, 34)"); // night-900 (allow-color-literal: computed value)

    for (const section of [
      "Grounds",
      "Text",
      "Brand",
      "Highlight",
      "Status",
      "Lines",
      "Type",
      "Spacing",
      "Radii",
      "Shadows",
    ]) {
      await expect(light.getByRole("heading", { name: section, exact: true })).toBeVisible();
    }
    await expect(page.getByTestId("panel-light").getByText("Other", { exact: true })).toHaveCount(
      0,
    );
  });

  test("loads the three font families from the app's own origin", async ({ page, baseURL }) => {
    const fontRequests: string[] = [];
    page.on("request", (request) => {
      if (request.resourceType() === "font") fontRequests.push(request.url());
    });
    await page.goto("/dev/tokens");
    const loaded = await page.evaluate(async () => {
      await document.fonts.ready;
      return [...document.fonts]
        .filter((font) => font.status === "loaded")
        .map((font) => font.family.replace(/"/g, ""));
    });

    expect(new Set(loaded)).toEqual(
      new Set(["Plus Jakarta Sans", "Inter", "Noto Sans Devanagari"]),
    );
    expect(fontRequests.length).toBeGreaterThanOrEqual(3);
    for (const url of fontRequests) expect(new URL(url).origin).toBe(new URL(baseURL!).origin);
  });

  test("follows the system theme until a choice is made, then keeps the choice", async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/dev/tokens");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    await page.getByRole("radio", { name: "Light" }).check();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(page.getByRole("radio", { name: "Light" })).toBeChecked();

    await page.getByRole("radio", { name: "System" }).check();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  });

  test("shows a focus ring on keyboard focus", async ({ page }) => {
    await page.goto("/dev/tokens");
    await page.getByRole("radio", { name: "System" }).focus();
    await page.keyboard.press("ArrowRight");
    const shadow = await page.evaluate(() => getComputedStyle(document.activeElement!).boxShadow);
    expect(shadow).toContain("0px 0px 0px 4px");
  });

  test("respects reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/dev/tokens");
    const duration = await page.evaluate(() => {
      const probe = document.createElement("div");
      probe.style.transition = "opacity 300ms";
      document.body.append(probe);
      return getComputedStyle(probe).transitionDuration;
    });
    expect(duration).toBe("0s");
  });
});
