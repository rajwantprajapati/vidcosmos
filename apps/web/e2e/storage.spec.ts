// F12: the storage stub serves files to the browser in development. /dev/storage stores a
// sample image and tone and shows them through signed URLs: the image loads, the audio seeks
// with Range (206), the download link is an attachment, and a tampered or unsigned link is
// refused (403). The store itself is covered in packages/integrations/src/storage.
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { hideNextDevTools } from "./helpers";

test("the stub serves signed files to the browser", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Runs once, on desktop");
  await page.goto("/dev/storage");
  await expect(page.getByRole("heading", { name: "Storage", level: 1 })).toBeVisible();
  await expect(page.getByText("storage stub")).toBeVisible();

  const image = page.getByRole("img", { name: /Sample image/ });
  await expect(image).toBeVisible();
  await expect
    .poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth))
    .toBe(96);

  const audioUrl = await page.locator("audio").getAttribute("src");
  expect(audioUrl).toContain("/api/dev/storage/dev/sample-tone.wav?");
  const whole = await page.request.get(audioUrl!);
  expect(whole.status()).toBe(200);
  expect(whole.headers()["content-type"]).toBe("audio/wav");
  expect(whole.headers()["accept-ranges"]).toBe("bytes");
  expect(whole.headers()["x-content-type-options"]).toBe("nosniff");
  expect(whole.headers()["content-security-policy"]).toBe("sandbox");
  // Next.js drops Content-Length from route-handler responses; Content-Range gives the size.
  const head = await page.request.head(audioUrl!);
  expect(head.status()).toBe(200);
  expect(head.headers()["content-type"]).toBe("audio/wav");
  const part = await page.request.get(audioUrl!, { headers: { Range: "bytes=0-99" } });
  expect(part.status()).toBe(206);
  expect(part.headers()["content-range"]).toBe(`bytes 0-99/${(await whole.body()).length}`);

  const download = await page
    .getByRole("link", { name: "Download the sample image" })
    .getAttribute("href");
  const file = await page.request.get(download!);
  expect(file.headers()["content-disposition"]).toContain(
    'attachment; filename="Sample image.png"',
  );

  const tampered = audioUrl!.replace("sample-tone.wav", "sample-image.png");
  expect((await page.request.get(tampered)).status()).toBe(403);
  expect((await page.request.get("/api/dev/storage/dev/sample-tone.wav")).status()).toBe(403);
  const signedForReading = await page.request.put(audioUrl!, {
    data: "x",
    headers: { "Content-Type": "audio/wav" },
  });
  expect(signedForReading.status()).toBe(403);
});

test("/dev/storage has no accessibility problems and fits a phone", async ({ page }) => {
  await page.goto("/dev/storage");
  await hideNextDevTools(page);
  await expect(page.getByRole("img", { name: /Sample image/ })).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
});
