// The theme is set before the first paint: the inline script in <head> runs while the HTML is
// parsed, before Next's own scripts. Next's scripts are delayed here to prove it doesn't wait
// for them (that would show a light page first to dark-theme users).
import { expect, type Page, test } from "@playwright/test";

const delayNextScripts = async (page: Page) => {
  await page.route("**/_next/static/chunks/**", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.continue();
  });
};

const themeAtDomContentLoaded = async (page: Page, path: string) => {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  return page.evaluate(() => document.documentElement.getAttribute("data-theme"));
};

test.describe("theme before first paint", () => {
  test("a stored dark choice is on <html> before Next's scripts load", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("vc-theme", "dark"));
    await delayNextScripts(page);
    expect(await themeAtDomContentLoaded(page, "/sign-in")).toBe("dark");
  });

  test("a dark system setting is used when nothing is stored", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await delayNextScripts(page);
    expect(await themeAtDomContentLoaded(page, "/sign-in")).toBe("dark");
  });

  test("a stored light choice wins over a dark system setting", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.addInitScript(() => localStorage.setItem("vc-theme", "light"));
    await delayNextScripts(page);
    expect(await themeAtDomContentLoaded(page, "/sign-in")).toBe("light");
  });

  test("the theme script is inline in <head>, before the body", async ({ request }) => {
    const html = await (await request.get("/sign-in")).text();
    const head = html.slice(0, html.indexOf("<body"));
    expect(head).toContain('setAttribute("data-theme"');
    expect(head).toMatch(/<script>\(function \(\) \{/);
  });
});
