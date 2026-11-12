// F09: the library. Create from the prompt box, rename, duplicate, delete with Undo, Trash and
// restore, filters and search, the empty state, and the phone layout.
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { hideNextDevTools, signUpReady } from "./helpers";

/** Creates a project through the API (the prompt box is tested on its own). */
async function createProject(page: Page, topic: string, extra: Record<string, unknown> = {}) {
  const origin = new URL(page.url()).origin;
  const response = await page.request.post("/api/v1/projects", {
    data: { topic, ...extra },
    headers: { Origin: origin, "Idempotency-Key": crypto.randomUUID() },
  });
  expect(response.status()).toBe(201);
}

/** The video cards: links into a project (not "Start a new video"). */
const cards = (page: Page) =>
  page.locator("main a[href^='/projects/']:not([href='/projects/new'])");
const cardTitles = (page: Page) => cards(page).locator("> div:last-child > div:first-child");

test.beforeEach(async ({ page }) => {
  await hideNextDevTools(page);
});

test.describe("library", () => {
  test("a new account sees the empty state", async ({ page }) => {
    await signUpReady(page, "lib-empty");
    await page.goto("/library");
    await expect(page.getByRole("heading", { level: 1, name: "Your library" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Make your first video" })).toBeVisible();
    await expect(page.getByRole("group", { name: "Filter videos" })).toHaveCount(0);
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });

  test("desktop: the prompt box creates a video and opens step 1", async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop",
      "the prompt box is on desktop; phones open New video",
    );
    await signUpReady(page, "lib-create");
    await page.goto("/library");

    // From the empty state: an idea fills the prompt, the type and format are kept.
    await page.getByRole("button", { name: "How vaccines train your immune system" }).click();
    await expect(page.getByLabel("Describe your video")).toHaveValue(
      "How vaccines train your immune system",
    );
    await page.getByRole("button", { name: "Product ad", exact: true }).click();
    await page.getByRole("radio", { name: "16:9" }).click();
    await page.getByRole("button", { name: "Generate video" }).click();
    // Opening step 1 is a client navigation that loads the page; the dev server can be slow
    // when several tests run at once.
    await expect(page).toHaveURL(/\/projects\/[0-9a-f]{24}\/idea$/, { timeout: 15_000 });

    await page.goto("/library");
    const card = page.getByRole("link", { name: /How vaccines train your immune system/ });
    await expect(card).toContainText("Product ad");
    await expect(card).toContainText("Draft · idea");

    // An empty prompt says what to do instead of sending.
    await page.getByRole("button", { name: "Generate video" }).click();
    await expect(page.getByText("Describe your video in a few words.")).toBeVisible();
    await expect(page.getByLabel("Describe your video")).toBeFocused();
    await expect(page.getByLabel("Describe your video")).toHaveAttribute("aria-invalid", "true");
    await page.getByLabel("Describe your video").fill("Photosynthesis in 60 seconds");
    await expect(page.getByText("Describe your video in a few words.")).toBeHidden();
    await expect(page.getByLabel("Describe your video")).not.toHaveAttribute("aria-invalid");

    // From the library's own prompt box.
    await page.getByRole("button", { name: "Generate video" }).click();
    await expect(page).toHaveURL(/\/idea$/, { timeout: 15_000 });
    await page.goto("/library");
    await expect(page.getByRole("link", { name: "All 2" })).toBeVisible();
  });

  test("rename, duplicate, delete with Undo, Trash and restore", async ({ page }) => {
    await signUpReady(page, "lib-actions");
    await createProject(page, "How UPI moves money");
    await page.goto("/library");

    // Rename
    await page.getByRole("button", { name: "More actions for How UPI moves money" }).click();
    await page.getByRole("menuitem", { name: "Rename" }).click();
    const dialog = page.getByRole("dialog", { name: "Rename video" });
    await dialog.getByLabel("Title").fill("UPI in 3 hops");
    await dialog.getByRole("button", { name: "Save title" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("link", { name: /UPI in 3 hops/ })).toBeVisible();
    // Focus goes back to where the user started.
    await expect(
      page.getByRole("button", { name: "More actions for UPI in 3 hops" }),
    ).toBeFocused();
    await page.keyboard.press("Enter");
    await page.getByRole("menuitem", { name: "Rename" }).click();
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(
      page.getByRole("button", { name: "More actions for UPI in 3 hops" }),
    ).toBeFocused();

    // Duplicate
    await page.getByRole("button", { name: "More actions for UPI in 3 hops" }).click();
    await page.getByRole("menuitem", { name: "Duplicate" }).click();
    await expect(page.getByRole("link", { name: /UPI in 3 hops \(copy\)/ })).toBeVisible();
    await expect(page.getByRole("link", { name: "All 2" })).toBeVisible();

    // Delete, then Undo from the message
    await page.getByRole("button", { name: "More actions for UPI in 3 hops (copy)" }).click();
    await page.getByRole("menuitem", { name: "Move to Trash" }).click();
    await expect(page.getByText("Moved to Trash")).toBeVisible();
    await expect(page.getByRole("link", { name: "All 1" })).toBeVisible();
    // The card is gone, so focus goes to Undo.
    await expect(page.getByRole("button", { name: "Undo" })).toBeFocused();
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(page.getByRole("link", { name: "All 2" })).toBeVisible();

    // Delete again, then restore from Trash
    await page.getByRole("button", { name: "More actions for UPI in 3 hops (copy)" }).click();
    await page.getByRole("menuitem", { name: "Move to Trash" }).click();
    await expect(page.getByRole("link", { name: "All 1" })).toBeVisible();
    await page.getByRole("link", { name: "Trash (1)" }).click();
    await expect(page).toHaveURL(/\/library\?trash=true$/);
    await expect(page.getByRole("heading", { level: 1, name: "Trash" })).toBeVisible();
    await expect(page.getByRole("main").getByText("UPI in 3 hops (copy)").first()).toBeVisible();
    await page.getByRole("button", { name: "Restore UPI in 3 hops (copy)" }).click();
    await expect(page.getByText("Trash is empty.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Back to your library" })).toBeFocused();
    await page.getByRole("link", { name: "Back to your library" }).click();
    await expect(page.getByRole("link", { name: "All 2" })).toBeVisible();
  });

  test("the Undo message waits while it has focus, then hands focus back to the page", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await signUpReady(page, "lib-undo-focus");
    await createProject(page, "First video to keep");
    await createProject(page, "Second video to trash");
    await page.goto("/library");

    await page.getByRole("button", { name: "More actions for Second video to trash" }).focus();
    await page.keyboard.press("Enter");
    await page.getByRole("menuitem", { name: "Move to Trash" }).press("Enter");
    const undo = page.getByRole("button", { name: "Undo" });
    await expect(undo).toBeFocused();

    // Past the 10 s an action message normally stays: it waits while it has focus.
    await page.waitForTimeout(11_500);
    await expect(page.getByText("Moved to Trash")).toBeVisible();
    await expect(undo).toBeFocused();

    // Closed from the keyboard: focus lands on the card now in that place, not on the page body.
    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");
    await expect(page.getByText("Moved to Trash")).toBeHidden();
    await expect(
      page.getByRole("button", { name: "More actions for First video to keep" }),
    ).toBeFocused();
  });

  test("filters and search change the grid", async ({ page }) => {
    await signUpReady(page, "lib-filter");
    await createProject(page, "Photosynthesis in 60 seconds");
    await createProject(page, "How UPI moves money", { videoType: "explainer" });
    await createProject(page, "Diwali gift guide", { videoType: "product_ad" });
    await page.goto("/library");
    await expect(cardTitles(page)).toHaveText([
      "Diwali gift guide",
      "How UPI moves money",
      "Photosynthesis in 60 seconds",
    ]);

    // Search by title or topic, 300 ms after typing
    await page.getByLabel("Search videos").fill("upi");
    await expect(page).toHaveURL(/q=upi/);
    await expect(cardTitles(page)).toHaveText(["How UPI moves money"]);
    await expect(page.getByRole("status").filter({ hasText: "matches" })).toHaveText(
      "1 video matches “upi”",
    );
    await page.getByLabel("Search videos").fill("nothing like this");
    await expect(page.getByText("No videos match “nothing like this”.")).toBeVisible();
    await page.getByRole("link", { name: "Show all videos" }).click();
    await expect(cardTitles(page)).toHaveCount(3);
    await expect(page.getByLabel("Search videos")).toHaveValue("");
    await page.waitForTimeout(500); // the box must not put the old search back
    await expect(page).toHaveURL(/\/library$/);
    await page.getByLabel("Search videos").fill("photo");
    await expect(cardTitles(page)).toHaveText(["Photosynthesis in 60 seconds"]);
    await page.getByLabel("Search videos").fill("");
    await expect(cardTitles(page)).toHaveCount(3);

    // Stage chips with their counts
    const filters = page.getByRole("group", { name: "Filter videos" });
    await expect(filters.getByRole("link")).toHaveText([
      "All 3",
      "Drafts 3",
      "Ready 0",
      "Failed 0",
    ]);
    await filters.getByRole("link", { name: "Ready 0" }).click();
    await expect(page).toHaveURL(/stage=ready/);
    await expect(page.getByText("No videos here yet.")).toBeVisible();
    await expect(filters.getByRole("link", { name: "Ready 0" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await filters.getByRole("link", { name: "Drafts 3" }).click();
    await expect(cardTitles(page)).toHaveCount(3);
    await filters.getByRole("link", { name: "All 3" }).click();
    await expect(page).toHaveURL(/\/library$/);

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    expect(await cards(page).count()).toBe(3);
  });

  test("cards of every shape: menu beside the title, long titles clamped, Hindi marked", async ({
    page,
  }) => {
    await signUpReady(page, "lib-shapes");
    await createProject(page, "उपयोगी वीडियो: UPI पेमेंट कैसे काम करता है", {
      settings: { format: "9:16" },
    });
    await createProject(
      page,
      `${"Averyveryverylongunbrokenword".repeat(4)} and a long title for a wide card`,
      {
        settings: { format: "16:9" },
      },
    );
    await createProject(page, "A square video about photosynthesis and light", {
      settings: { format: "1:1" },
    });
    await createProject(page, "Ember & Wick — Diwali launch", { settings: { format: "16:9" } });
    await page.goto("/library");

    for (const card of await cards(page).all()) {
      const name = (await card.locator("> div:last-child > div:first-child").textContent()) ?? "";
      const title = await card.locator("> div:last-child > div:first-child").boundingBox();
      const menu = await page
        .getByRole("button", { name: `More actions for ${name}` })
        .boundingBox();
      // Centred on the title line, whatever the thumbnail's shape.
      expect(
        Math.abs(menu!.y + menu!.height / 2 - (title!.y + title!.height / 2)),
        name,
      ).toBeLessThan(3);

      // The title on the thumbnail stays inside it.
      const thumb = card.locator("> div:first-child");
      const box = await thumb.boundingBox();
      const headline = await thumb.locator("> div:first-child").boundingBox();
      expect(headline!.x + headline!.width, name).toBeLessThanOrEqual(box!.x + box!.width + 0.5);
      expect(headline!.y + headline!.height, name).toBeLessThanOrEqual(box!.y + box!.height);
      // Whole lines only: a box shorter than its lines cuts the last one through the middle.
      const lineHeight = await thumb
        .locator("> div:first-child")
        .evaluate((el) => parseFloat(getComputedStyle(el).lineHeight));
      const lines = headline!.height / lineHeight;
      expect(
        Math.abs(lines - Math.round(lines)),
        `${name}: ${lines.toFixed(2)} lines`,
      ).toBeLessThan(0.1);
    }

    // Each card link says its title once (the thumbnail is hidden from assistive tech).
    for (const card of await cards(page).all()) {
      const name = (await card.locator("> div:last-child > div:first-child").textContent()) ?? "";
      const linkLine = (await card.ariaSnapshot()).split("\n")[0] ?? "";
      expect(linkLine.split(name).length - 1, linkLine).toBe(1);
    }

    const hindi = cards(page).filter({ hasText: "उपयोगी" });
    await expect(hindi.locator("> div:last-child > div:first-child")).toHaveAttribute("lang", "hi");
    const font = await hindi
      .locator("> div:first-child > div:first-child")
      .evaluate((el) => getComputedStyle(el).fontFamily);
    expect(font).toContain("Noto Sans Devanagari");
  });

  test("phone: start a video opens New video, two columns, no sideways scroll", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "phone layout");
    await signUpReady(page, "lib-phone");
    await createProject(page, "How UPI moves money");
    await createProject(page, "Diwali gift guide");
    await page.goto("/library");

    await expect(page.getByLabel("Describe your video")).toBeHidden();
    const search = await page.getByLabel("Search videos").boundingBox();
    expect(Math.round(search?.width ?? 0)).toBe(358); // 390 less 16 px each side

    const [first, second] = await cards(page).all();
    const a = await first!.boundingBox();
    const b = await second!.boundingBox();
    expect(Math.round(a!.y)).toBe(Math.round(b!.y)); // side by side
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);

    await page.getByRole("link", { name: /Start a new video/ }).click();
    await expect(page).toHaveURL(/\/projects\/new$/);
  });
});
