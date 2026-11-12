// F07: the onboarding screen. First visit to the app goes there; saving or skipping lands in
// the library, and it doesn't come back.
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { MeDto } from "@vidcosmos/spec/api";
import { newEmail, signUp } from "./helpers";

test.describe("onboarding", () => {
  test.beforeEach(async ({ page }) => {
    await signUp(page, newEmail("onboard"), "Asha Rao");
  });

  test("a new account goes to onboarding, saves its answers and lands in the library", async ({
    page,
  }) => {
    await page.goto("/library");
    await expect(page).toHaveURL(/\/onboarding$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Hi Asha, let’s set up your studio" }),
    ).toBeVisible();
    await expect(page.getByRole("radio", { name: /Creator/ })).toHaveAttribute(
      "aria-checked",
      "true",
    );

    await page.getByRole("radio", { name: /Educator/ }).click();
    await page.getByLabel("Topic area (optional)").fill("Science for class 8");
    await page.getByRole("radio", { name: "हिंदी" }).click();
    await page.getByRole("radio", { name: "Male", exact: true }).click();

    // The page moves on as soon as the save answers, so the body is captured on the way.
    let me: MeDto | undefined;
    await page.route("**/api/v1/me/onboarding", async (route) => {
      const response = await route.fetch();
      me = (await response.json()) as MeDto;
      await route.fulfill({ response });
    });
    await page.getByRole("button", { name: "Start making videos" }).click();
    await expect(page).toHaveURL(/\/library$/);
    if (!me) throw new Error("The onboarding response was not captured.");
    expect(me.onboarding).toMatchObject({
      persona: "educator",
      topicArea: "Science for class 8",
      language: "hi",
    });
    expect(me.workspace.defaults).toMatchObject({
      language: "hi",
      voiceGender: "male",
      format: "9:16",
    });
    expect(me.usage.videos).toEqual({ used: 0, reserved: 0, max: 20 });
    expect(me.user).not.toHaveProperty("password");
    expect(JSON.stringify(me)).not.toContain("workspaceId");

    await page.goto("/onboarding");
    await expect(page).toHaveURL(/\/library$/);
  });

  test("Skip for now lands in the library and the screen doesn't come back", async ({ page }) => {
    await page.goto("/onboarding");
    await page.getByRole("button", { name: "Skip for now" }).click();
    await expect(page).toHaveURL(/\/library$/);
    await page.goto("/posts");
    await expect(page).toHaveURL(/\/posts$/);
    await page.goto("/onboarding");
    await expect(page).toHaveURL(/\/library$/);
  });

  test("the page asked for comes back after skipping", async ({ page }) => {
    await page.goto("/posts");
    await expect(page).toHaveURL(/\/onboarding\?next=%2Fposts$/);
    await page.getByRole("button", { name: "Skip for now" }).click();
    await expect(page).toHaveURL(/\/posts$/);
  });

  test("the page asked for comes back after saving", async ({ page }) => {
    const script = "/projects/6740a1b2c3d4e5f601234567/script";
    await page.goto(script);
    await expect(page).toHaveURL(/\/onboarding\?next=/);
    await page.getByRole("button", { name: "Start making videos" }).click();
    await expect(page).toHaveURL(new RegExp(`${script}$`));
  });

  test("a return address off the site is ignored", async ({ page }) => {
    await page.goto("/onboarding?next=%2F%2Fevil.example");
    await page.getByRole("button", { name: "Skip for now" }).click();
    await expect(page).toHaveURL(/localhost:\d+\/library$/);
  });

  test("a return address with control characters stays on this site", async ({ page }) => {
    // "/<tab>/host": browsers drop the tab and would go to //host.
    await page.goto("/onboarding?next=%2F%09%2Fexample.org");
    await page.getByRole("button", { name: "Skip for now" }).click();
    await expect(page).toHaveURL(/^http:\/\/localhost:\d+\/library$/);
    for (const next of [
      "%2F%09%2Fexample.org",
      "%2F%0A%2Fexample.org",
      "%2F%0D%2Fexample.org",
      "%09%2Fexample.org",
    ]) {
      const response = await page.goto(`/onboarding?next=${next}`);
      expect(response?.status(), next).toBe(200);
      await expect(page, next).toHaveURL(/^http:\/\/localhost:\d+\/library$/);
    }
  });

  test("arrow keys move the choice between the cards", async ({ page }) => {
    await page.goto("/onboarding");
    await page.getByRole("radio", { name: /Creator/ }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("radio", { name: /Educator/ })).toBeFocused();
    await expect(page.getByRole("radio", { name: /Educator/ })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    await expect(page.getByRole("radio", { name: /Something else/ })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  test("has no accessibility violations (axe) and no sideways scroll", async ({ page }) => {
    await page.goto("/onboarding");
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);
  });
});

test.describe("PUT /api/v1/me/onboarding", () => {
  const body = { persona: "creator", language: "en", voiceGender: "female" };

  test("needs a session", async ({ request, baseURL }) => {
    const response = await request.put("/api/v1/me/onboarding", {
      data: body,
      headers: { Origin: baseURL! },
    });
    expect(response.status()).toBe(401);
    expect((await response.json()).error).toMatchObject({ code: "UNAUTHENTICATED" });
  });

  test("refuses another origin, a bad body and operator keys", async ({ page, baseURL }) => {
    await signUp(page, newEmail("api"));
    const put = (data: unknown, origin = baseURL!) =>
      page.request.put("/api/v1/me/onboarding", { data, headers: { Origin: origin } });

    const foreign = await put(body, "https://evil.example");
    expect(foreign.status()).toBe(403);
    expect((await foreign.json()).error.code).toBe("CSRF_ORIGIN");

    const invalid = await put({ persona: "pirate", language: "fr" });
    expect(invalid.status()).toBe(400);
    const { error } = await invalid.json();
    expect(error.code).toBe("VALIDATION_FAILED");
    expect(error.fields.map((f: { path: string }) => f.path)).toEqual(
      expect.arrayContaining(["persona", "language", "voiceGender"]),
    );
    expect(error.requestId).toEqual(expect.any(String));

    const operator = await put({ ...body, $where: "1" });
    expect(operator.status()).toBe(400);
    expect((await operator.json()).error.fields[0].path).toBe("$where");

    const ok = await put(body);
    expect(ok.status()).toBe(200);
    expect(ok.headers()["cache-control"]).toBe("private, no-store");
    expect(ok.headers()["x-request-id"]).toEqual(expect.any(String));
  });
});
