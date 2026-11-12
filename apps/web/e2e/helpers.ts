// Shared steps for the e2e tests: new accounts, signing in, emails from the stub outbox.
import { expect, type APIRequestContext, type Page } from "@playwright/test";

export const password = "correct-horse-battery";

/** A new address per call, so runs never collide. */
export const newEmail = (label: string) =>
  `e2e+${label}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;

/** The newest link of one kind in the stub outbox, waiting for it to arrive. */
export async function emailedLink(
  request: APIRequestContext,
  to: string,
  kind: "verify_email" | "reset_password",
) {
  let link: string | undefined;
  await expect
    .poll(
      async () => {
        const response = await request.get(`/api/dev/outbox?to=${encodeURIComponent(to)}`);
        const { messages } = (await response.json()) as {
          messages: { kind: string; link?: string }[];
        };
        link = messages.find((m) => m.kind === kind)?.link;
        return link;
      },
      { message: `${kind} email to ${to}`, timeout: 10_000 },
    )
    .toBeTruthy();
  return link!;
}

export async function signUp(page: Page, email: string, name = "Asha Rao") {
  await page.goto("/sign-up");
  await page.getByLabel("Your name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/verify$/);
}

export async function signIn(page: Page, email: string, secret = password) {
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(secret);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

/** "Skip for now" through the API, for tests about something other than onboarding. */
export async function skipOnboarding(page: Page) {
  const origin = new URL(page.url()).origin;
  const response = await page.request.post("/api/v1/me/onboarding/skip", {
    headers: { Origin: origin },
  });
  expect(response.status()).toBe(200);
}

/** A signed-in account that has finished (skipped) onboarding, ready for the app. */
export async function signUpReady(page: Page, label: string, name = "Asha Rao") {
  const email = newEmail(label);
  await signUp(page, email, name);
  await skipOnboarding(page);
  return email;
}

/**
 * Hides Next.js's dev-tools button, which `pnpm dev` draws in a screen corner. On phones it can
 * sit on top of the tab bar and catch the tap; production has no such button.
 */
export async function hideNextDevTools(page: Page) {
  await page.addInitScript(() => {
    const style = document.createElement("style");
    style.textContent = "nextjs-portal { display: none !important; }";
    document.addEventListener("DOMContentLoaded", () => document.head.append(style));
  });
}
