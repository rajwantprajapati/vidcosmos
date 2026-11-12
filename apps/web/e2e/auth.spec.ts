// F06: sign up, verify, sign in, sign out; route protection; duplicate email; reset password.
// Runs against `pnpm dev` with the stub email provider, whose messages the dev-only
// /api/dev/outbox route returns. Each test uses a new address, so runs never collide.
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { emailedLink, newEmail, signIn, signUp, skipOnboarding } from "./helpers";

test.describe("sign up and sign in", () => {
  test("sign up, confirm the email, reach the app, sign out, sign in again", async ({
    page,
    request,
  }) => {
    const email = newEmail("flow");
    await signUp(page, email);

    // A new account is signed in and asked to confirm its email.
    await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
    await expect(page.getByText(email)).toBeVisible();

    // Open the link from the logged email.
    await page.goto(await emailedLink(request, email, "verify_email"));
    await expect(page).toHaveURL(/\/verify\?confirmed=1/);
    await expect(page.getByRole("heading", { name: "Email confirmed" })).toBeVisible();
    await page.getByRole("link", { name: "Continue to Vidcosmos" }).click();

    // The first visit to the app is onboarding (F07); skipping it opens the library.
    await expect(page).toHaveURL(/\/onboarding$/);
    await page.getByRole("button", { name: "Skip for now" }).click();
    await expect(page).toHaveURL(/\/library$/);
    await expect(page.getByRole("heading", { name: "Your library" })).toBeVisible();

    // The workspace made at sign-up; signing out lives in Settings.
    await page.goto("/settings");
    await expect(page.getByText("Asha's workspace")).toBeVisible();
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/sign-in$/);
    await page.goto("/library");
    await expect(page).toHaveURL(/\/sign-in$/);

    // Later sign-ins go straight to the library.
    await signIn(page, email);
    await expect(page).toHaveURL(/\/library$/);
    await page.goto("/settings");
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/sign-in$/);
  });

  test("a second account with the same email gets the duplicate message", async ({
    page,
    browser,
  }) => {
    const email = newEmail("dup");
    await signUp(page, email);

    const other = await browser.newPage();
    await other.goto("/sign-up");
    await other.getByLabel("Your name").fill("Someone Else");
    await other.getByLabel("Email").fill(email);
    await other.getByLabel("Password").fill("correct-horse-battery");
    await other.getByRole("button", { name: "Create account" }).click();
    await expect(
      other.getByText(
        "An account with this email already exists. Sign in instead, or reset your password.",
      ),
    ).toBeVisible();
    await expect(other).toHaveURL(/\/sign-up$/);
    await expect(other.getByLabel("Email")).toHaveAttribute("aria-invalid", "true");
    // Focus moves to the field, so a screen reader reads the message out.
    await expect(other.getByLabel("Email")).toBeFocused();
    await other.close();
  });

  test("a wrong password is refused with a clear message", async ({ page }) => {
    const email = newEmail("wrong");
    await signUp(page, email);
    await page.context().clearCookies();

    await page.goto("/sign-in");
    await signIn(page, email, "not-the-password");
    await expect(page.getByRole("main").getByRole("alert")).toHaveText(
      "That email and password don't match. Check them, or reset your password.",
    );
    await expect(page).toHaveURL(/\/sign-in$/);
  });

  test("an empty form shows every field error and focuses the first", async ({ page }) => {
    await page.goto("/sign-up");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("Enter your name.")).toBeVisible();
    await expect(page.getByText("Enter your email address.")).toBeVisible();
    await expect(page.getByText("Use at least 10 characters.")).toBeVisible();
    await expect(page.getByLabel("Your name")).toBeFocused();
  });

  test("create account asks for 10 characters before sending anything", async ({ page }) => {
    await page.goto("/sign-up");
    await page.getByLabel("Your name").fill("Asha");
    await page.getByLabel("Email").fill(newEmail("short"));
    await page.getByLabel("Password").fill("short");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("Use at least 10 characters.")).toBeVisible();
    await expect(page).toHaveURL(/\/sign-up$/);
  });

  test("the switch moves between sign in and create account", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByRole("radio", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/sign-up$/);
    await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
    await page.getByRole("radio", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/sign-in$/);
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  });
});

test.describe("route protection", () => {
  test("a signed-out visit to /library goes to sign-in", async ({ page }) => {
    await page.goto("/library");
    await expect(page).toHaveURL(/\/sign-in$/);
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  });

  test("a deeper app page comes back after signing in", async ({ page }) => {
    const email = newEmail("next");
    await signUp(page, email);
    await skipOnboarding(page);
    await page.context().clearCookies();

    const script = "/projects/6740a1b2c3d4e5f601234567/script";
    await page.goto(script);
    await expect(page).toHaveURL(
      /\/sign-in\?next=%2Fprojects%2F6740a1b2c3d4e5f601234567%2Fscript$/,
    );
    await signIn(page, email);
    await expect(page).toHaveURL(new RegExp(`${script}$`));
    await expect(page.getByRole("heading", { name: "Script" })).toBeVisible();
  });

  test("a forged session cookie does not open the app", async ({ page, context }) => {
    await context.addCookies([
      { name: "better-auth.session_token", value: "forged.value", url: "http://localhost:3000" },
    ]);
    await page.goto("/library");
    await expect(page).toHaveURL(/\/sign-in$/);
  });

  test("a signed-in visit to /sign-in goes to the library", async ({ page }) => {
    await signUp(page, newEmail("signedin"));
    await skipOnboarding(page);
    await page.goto("/sign-in");
    await expect(page).toHaveURL(/\/library$/);
  });
});

test.describe("reset password", () => {
  test("ask for a link, set a new password, sign in with it", async ({ page, request }) => {
    const email = newEmail("reset");
    await signUp(page, email);
    await skipOnboarding(page);
    await page.context().clearCookies();

    await page.goto("/sign-in");
    await page.getByRole("link", { name: "Forgot password?" }).click();
    await expect(page.getByRole("heading", { name: "Reset your password" })).toBeVisible();
    await page.getByLabel("Email").fill(email);
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();

    await page.goto(await emailedLink(request, email, "reset_password"));
    await expect(page.getByRole("heading", { name: "Choose a new password" })).toBeVisible();
    await page.getByLabel("New password").fill("a-brand-new-passphrase");
    await page.getByRole("button", { name: "Save new password" }).click();

    await expect(page).toHaveURL(/\/sign-in\?notice=reset$/);
    await expect(page.getByRole("main").getByRole("status")).toHaveText(
      "Your password is changed. Sign in with the new one.",
    );
    await signIn(page, email, "a-brand-new-passphrase");
    await expect(page).toHaveURL(/\/library$/);
  });

  test("an invalid link says so and offers a new one", async ({ page }) => {
    await page.goto("/api/auth/reset-password/not-a-token?callbackURL=%2Freset-password");
    await expect(page).toHaveURL(/\/reset-password\?error=INVALID_TOKEN$/);
    await expect(page.getByRole("main").getByRole("alert")).toHaveText(
      "That link has expired or was already used. Ask for a new one.",
    );
  });
});

test.describe("sign-in page", () => {
  for (const path of ["/sign-in", "/sign-up"]) {
    test(`${path} has no accessibility violations (axe)`, async ({ page }) => {
      await page.goto(path);
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations.map((v) => `${v.id}: ${v.nodes.length} × ${v.help}`)).toEqual([]);
    });
  }

  test("has no sideways scroll", async ({ page }) => {
    await page.goto("/sign-in");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);
  });
});
