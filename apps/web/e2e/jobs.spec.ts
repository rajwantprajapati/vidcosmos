// F11: background jobs end to end, with `pnpm dev` and the Inngest Dev Server (both started
// by the Playwright config). The demo job on /dev/jobs moves through its stages, a reload
// shows the same job, a second start on the same video is refused (409 JOB_IN_PROGRESS),
// cancel stops it, and a fresh run finishes. The API checks status codes, ETags and
// ownership. Retry and failure are covered by the @inngest/test tests.
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { jobDto, pageOf } from "@vidcosmos/spec/api";
import { hideNextDevTools, signUpReady } from "./helpers";

async function createProject(page: Page, topic: string) {
  const origin = new URL(page.url()).origin;
  const response = await page.request.post("/api/v1/projects", {
    headers: { Origin: origin, "Idempotency-Key": crypto.randomUUID() },
    data: { topic },
  });
  expect(response.status()).toBe(201);
  return ((await response.json()) as { id: string }).id;
}

async function startDemo(page: Page, projectId: string, mode = "succeed") {
  return page.request.post("/api/dev/jobs/demo", {
    headers: { Origin: new URL(page.url()).origin, "Idempotency-Key": crypto.randomUUID() },
    data: { projectId, mode },
  });
}

const jobCard = (page: Page) => page.locator("article[data-job-id]");

test.describe("demo job on /dev/jobs", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "The job flow runs once, on desktop");
  });

  test("moves through its stages, survives a reload, refuses a second start and cancels", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await signUpReady(page, "jobs");
    await createProject(page, "How UPI moves money");
    await page.goto("/dev/jobs");
    await hideNextDevTools(page);
    await expect(page.getByRole("heading", { name: "Jobs", level: 1 })).toBeVisible();
    await expect(page.getByText("Nothing is running.")).toBeVisible();

    await page.getByRole("button", { name: "Start demo job" }).click();
    const card = jobCard(page);
    await expect(card).toHaveCount(1);
    const jobId = await card.getAttribute("data-job-id");
    await expect(card.getByRole("progressbar", { name: /Recording narration/ })).toBeVisible({
      timeout: 30_000,
    });
    const before = Number(await card.getByRole("progressbar").getAttribute("aria-valuenow"));
    expect(before).toBeGreaterThanOrEqual(40);

    // A reload picks the same job up again, still running.
    await page.reload();
    await expect(jobCard(page)).toHaveAttribute("data-job-id", jobId!);
    await expect(jobCard(page)).toHaveAttribute("data-status", "running");
    const after = Number(
      await jobCard(page).getByRole("progressbar").getAttribute("aria-valuenow"),
    );
    expect(after).toBeGreaterThanOrEqual(before);

    // One running job per video.
    await page.getByRole("button", { name: "Start demo job" }).click();
    await expect(page.locator("main").getByRole("alert")).toHaveText(
      "Something is already running on this video.",
    );
    await expect(jobCard(page)).toHaveCount(1);

    // Cancel stops it at the next step.
    await jobCard(page).getByRole("button", { name: "Cancel" }).click();
    // The Cancel button goes away; focus stays on the job, not the page.
    await expect(jobCard(page).getByRole("heading", { level: 3 })).toBeFocused();
    await expect(jobCard(page)).toHaveAttribute("data-status", "cancelled", { timeout: 15_000 });
    await expect(jobCard(page).getByText("Cancelled", { exact: true }).first()).toBeVisible();
    const stopped = await page.request.get(`/api/v1/jobs/${jobId}`);
    expect(jobDto.parse(await stopped.json()).progress).toBeLessThan(100);

    // The video is free again: a new run goes all the way.
    await page.getByRole("button", { name: "Start demo job" }).click();
    const fresh = jobCard(page).first();
    await expect(fresh).not.toHaveAttribute("data-job-id", jobId!);
    await expect(fresh).toHaveAttribute("data-status", "succeeded", { timeout: 45_000 });
    await expect(fresh.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
    await expect(fresh.getByRole("button", { name: "Cancel" })).toHaveCount(0);

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
});

test.describe("jobs API", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "API tests run on the desktop project only");
  });

  test("starts, polls with an ETag, lists, refuses and cancels; other workspaces get 404", async ({
    page,
    browser,
  }) => {
    test.setTimeout(60_000);
    await signUpReady(page, "jobs-api");
    const projectId = await createProject(page, "Why the sky is blue");

    const started = await startDemo(page, projectId);
    expect(started.status()).toBe(202);
    const job = jobDto.parse(await started.json());
    expect(started.headers()["location"]).toBe(`/api/v1/jobs/${job.id}`);
    expect(job).toMatchObject({ type: "demo", projectId, cancellable: true });

    const second = await startDemo(page, projectId);
    expect(second.status()).toBe(409);
    expect((await second.json()).error).toMatchObject({
      code: "JOB_IN_PROGRESS",
      details: { jobId: job.id },
    });

    const read = await page.request.get(`/api/v1/jobs/${job.id}`);
    expect(read.status()).toBe(200);
    const etag = read.headers()["etag"];
    const same = await page.request.get(`/api/v1/jobs/${job.id}`, {
      headers: { "If-None-Match": "*" },
    });
    expect(same.status()).toBe(304);
    expect(etag).toBeTruthy();

    const active = pageOf(jobDto).parse(
      await (await page.request.get("/api/v1/jobs?active=true")).json(),
    );
    expect(active.items.map((j) => j.id)).toEqual([job.id]);

    // Someone else can't see or stop it.
    const stranger = await browser.newPage();
    await signUpReady(stranger, "jobs-stranger");
    expect((await stranger.request.get(`/api/v1/jobs/${job.id}`)).status()).toBe(404);
    const theirCancel = await stranger.request.post(`/api/v1/jobs/${job.id}/cancel`, {
      headers: { Origin: new URL(stranger.url()).origin },
    });
    expect(theirCancel.status()).toBe(404);
    await stranger.close();

    const origin = new URL(page.url()).origin;
    const cancel = await page.request.post(`/api/v1/jobs/${job.id}/cancel`, {
      headers: { Origin: origin },
    });
    expect(cancel.status()).toBe(202);
    expect(jobDto.parse(await cancel.json()).cancellable).toBe(false);

    await expect
      .poll(
        async () =>
          jobDto.parse(await (await page.request.get(`/api/v1/jobs/${job.id}`)).json()).status,
        {
          timeout: 15_000,
        },
      )
      .toBe("cancelled");

    const again = await page.request.post(`/api/v1/jobs/${job.id}/cancel`, {
      headers: { Origin: origin },
    });
    expect(again.status()).toBe(409);
    expect((await again.json()).error).toMatchObject({
      code: "NOT_CANCELLABLE",
      details: { status: "cancelled" },
    });
    const retry = await page.request.post(`/api/v1/jobs/${job.id}/retry`, {
      headers: { Origin: origin, "Idempotency-Key": crypto.randomUUID() },
    });
    expect(retry.status()).toBe(409);
    expect((await retry.json()).error.code).toBe("NOT_RETRYABLE");
  });
});

test("/dev/jobs works on a phone", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "Phone layout only");
  await signUpReady(page, "jobs-mobile");
  await createProject(page, "How UPI moves money");
  await page.goto("/dev/jobs");
  await hideNextDevTools(page);
  await expect(page.getByRole("button", { name: "Start demo job" })).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
});
