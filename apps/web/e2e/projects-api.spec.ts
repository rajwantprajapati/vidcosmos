// F08: the projects API over HTTP, against `pnpm dev`. Every response is checked against the
// schemas in @vidcosmos/spec/api. The database rules themselves are covered in
// packages/db/src/projects.test.ts; this checks the HTTP layer: status codes, headers, the
// error envelope and that nothing leaks between workspaces.
import {
  type APIRequestContext,
  type APIResponse,
  expect,
  type Page,
  test,
} from "@playwright/test";
import {
  draftSavedDto,
  leaseDto,
  pageOf,
  projectDetailDto,
  projectSummaryDto,
} from "@vidcosmos/spec/api";
import { signUpReady } from "./helpers";

// The API doesn't depend on the screen size: one run is enough.
test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "API tests run on the desktop project only");
});

type Api = {
  get: (path: string, headers?: Record<string, string>) => ReturnType<APIRequestContext["get"]>;
  send: (
    method: "POST" | "PATCH" | "PUT" | "DELETE",
    path: string,
    body?: unknown,
    headers?: Record<string, string>,
  ) => ReturnType<APIRequestContext["fetch"]>;
};

/** A signed-in user's API, with the app's Origin on every write. */
async function apiFor(page: Page, label: string): Promise<Api> {
  await signUpReady(page, label);
  const origin = new URL(page.url()).origin;
  return {
    get: (path, headers = {}) => page.request.get(`/api/v1${path}`, { headers }),
    send: (method, path, body, headers = {}) =>
      page.request.fetch(`/api/v1${path}`, {
        method,
        headers: { Origin: origin, ...headers },
        ...(body === undefined ? {} : { data: body }),
      }),
  };
}

const key = () => crypto.randomUUID();

/** A response body for field-by-field assertions; responses are also parsed with the schemas. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- test assertions read arbitrary JSON
const json = async (response: APIResponse): Promise<any> => response.json();

async function createProject(api: Api, topic = "How UPI moves money", extra = {}) {
  const response = await api.send(
    "POST",
    "/projects",
    { topic, ...extra },
    { "Idempotency-Key": key() },
  );
  expect(response.status()).toBe(201);
  return projectDetailDto.parse(await json(response));
}

test.describe("projects API", () => {
  test("create: 201 with Location, the detail shape, and replay by Idempotency-Key", async ({
    page,
  }) => {
    const api = await apiFor(page, "api-create");
    const body = { topic: "Photosynthesis in 60 seconds", settings: { format: "16:9" } };
    const idempotency = key();

    const first = await api.send("POST", "/projects", body, { "Idempotency-Key": idempotency });
    expect(first.status()).toBe(201);
    const project = projectDetailDto.parse(await json(first));
    expect(first.headers()["location"]).toBe(`/api/v1/projects/${project.id}`);
    expect(project).toMatchObject({
      title: "Photosynthesis in 60 seconds",
      stage: "draft",
      format: "16:9",
      settings: { format: "16:9", voiceSpeed: 1 },
      draft: { spec: null, rev: 0 },
      lease: null,
    });
    expect(JSON.stringify(project)).not.toMatch(/workspaceId|createdBy|holderSessionId/);

    const again = await api.send("POST", "/projects", body, { "Idempotency-Key": idempotency });
    expect(again.status()).toBe(201);
    expect(again.headers()["idempotent-replayed"]).toBe("true");
    expect((await json(again)).id).toBe(project.id);

    const different = await api.send(
      "POST",
      "/projects",
      { topic: "Something else" },
      {
        "Idempotency-Key": idempotency,
      },
    );
    expect(different.status()).toBe(422);
    expect((await json(different)).error.code).toBe("IDEMPOTENCY_MISMATCH");

    const list = pageOf(projectSummaryDto).parse(await (await api.get("/projects")).json());
    expect(list.items.map((p) => p.id)).toEqual([project.id]);
  });

  test("create: the key is required and the body is checked", async ({ page }) => {
    const api = await apiFor(page, "api-validate");
    const noKey = await api.send("POST", "/projects", { topic: "UPI" });
    expect(noKey.status()).toBe(400);
    expect((await json(noKey)).error.fields[0].path).toBe("Idempotency-Key");

    const short = await api.send(
      "POST",
      "/projects",
      { topic: "Hi" },
      { "Idempotency-Key": key() },
    );
    expect(short.status()).toBe(400);
    const { error } = await json(short);
    expect(error).toMatchObject({ code: "VALIDATION_FAILED", retryable: false });
    expect(error.fields.map((f: { path: string }) => f.path)).toEqual(["topic"]);
  });

  test("list: filters, paging and a bad cursor", async ({ page }) => {
    const api = await apiFor(page, "api-list");
    await createProject(api, "Photosynthesis basics", {
      settings: { language: "en", format: "9:16" },
    });
    await createProject(api, "UPI explained", { settings: { language: "hi", format: "16:9" } });
    await createProject(api, "Diwali gift guide", { settings: { language: "en", format: "1:1" } });

    const titles = async (query: string) =>
      pageOf(projectSummaryDto)
        .parse(await (await api.get(`/projects${query}`)).json())
        .items.map((p) => p.title);

    expect(await titles("")).toEqual([
      "Diwali gift guide",
      "UPI explained",
      "Photosynthesis basics",
    ]);
    expect(await titles("?language=hi")).toEqual(["UPI explained"]);
    expect(await titles("?format=1:1&format=9:16")).toEqual([
      "Diwali gift guide",
      "Photosynthesis basics",
    ]);
    expect(await titles("?q=upi")).toEqual(["UPI explained"]);
    expect(await titles("?stage=ready")).toEqual([]);
    expect(await titles("?sort=created&limit=1")).toEqual(["Diwali gift guide"]);

    const first = await json(await api.get("/projects?limit=2"));
    expect(first.items).toHaveLength(2);
    const second = await json(await api.get(`/projects?limit=2&cursor=${first.nextCursor}`));
    expect(second.items.map((p: { title: string }) => p.title)).toEqual(["Photosynthesis basics"]);
    expect(second.nextCursor).toBeNull();

    const bad = await api.get("/projects?cursor=nope");
    expect(bad.status()).toBe(400);
    expect((await json(bad)).error.code).toBe("INVALID_CURSOR");
    const badStage = await api.get("/projects?stage=done");
    expect(badStage.status()).toBe(400);
  });

  test("another workspace's project is 404 everywhere, and stays unchanged", async ({
    page,
    browser,
  }) => {
    const mine = await apiFor(page, "api-mine");
    const project = await createProject(mine, "My private video");

    const otherPage = await browser.newPage();
    const theirs = await apiFor(otherPage, "api-theirs");
    const path = `/projects/${project.id}`;
    const tab = { "X-Editor-Id": "tab-x" };
    const attempts = [
      await theirs.get(path),
      await theirs.send("PATCH", path, { title: "Taken" }),
      await theirs.send("DELETE", path),
      await theirs.send("POST", `${path}/restore`),
      await theirs.send("POST", `${path}/duplicate`, undefined, { "Idempotency-Key": key() }),
      await theirs.send("POST", `${path}/lease`, {}, tab),
      await theirs.send(
        "PUT",
        `${path}/draft`,
        { baseRev: 0, spec: { version: 1, scenes: [] } },
        tab,
      ),
    ];
    for (const response of attempts) {
      expect(response.status(), response.url()).toBe(404);
      expect((await json(response)).error.code).toBe("NOT_FOUND");
    }
    expect((await json(await theirs.get("/projects"))).items).toEqual([]);
    await otherPage.close();

    const still = projectDetailDto.parse(await (await mine.get(path)).json());
    expect(still).toMatchObject({ title: "My private video", deletedAt: null, lease: null });
  });

  test("project detail has an ETag; If-None-Match gets 304 until it changes", async ({ page }) => {
    const api = await apiFor(page, "api-etag");
    const project = await createProject(api);
    const path = `/projects/${project.id}`;

    const first = await api.get(path);
    const etag = first.headers()["etag"];
    expect(etag).toMatch(/^"[\w-]+"$/);
    expect(first.headers()["cache-control"]).toBe("private, no-cache");

    const same = await api.get(path, { "If-None-Match": etag! });
    expect(same.status()).toBe(304);
    expect(await same.text()).toBe("");
    expect((await api.get(path, { "If-None-Match": "*" })).status()).toBe(304);

    await api.send("PATCH", path, { title: "A new title" });
    const changed = await api.get(path, { "If-None-Match": etag! });
    expect(changed.status()).toBe(200);
    expect(changed.headers()["etag"]).not.toBe(etag);
    expect((await json(changed)).title).toBe("A new title");
  });

  test("an id that isn't an id is 404", async ({ page }) => {
    const api = await apiFor(page, "api-badid");
    expect((await api.get("/projects/not-an-id")).status()).toBe(404);
  });

  test("lease and draft: 423 LEASE_HELD, takeover, 409 REV_CONFLICT", async ({ page }) => {
    const api = await apiFor(page, "api-lease");
    const project = await createProject(api);
    const path = `/projects/${project.id}`;
    const tabA = { "X-Editor-Id": "tab-a" };
    const tabB = { "X-Editor-Id": "tab-b" };

    const lease = await api.send("POST", `${path}/lease`, undefined, tabA);
    expect(lease.status()).toBe(200);
    expect(leaseDto.parse(await json(lease))).toMatchObject({
      heldByMe: true,
      holderName: "Asha Rao",
    });

    const held = await api.send("POST", `${path}/lease`, {}, tabB);
    expect(held.status()).toBe(423);
    expect((await json(held)).error).toMatchObject({
      code: "LEASE_HELD",
      details: { heldBy: "you_elsewhere" },
    });

    const detail = projectDetailDto.parse(await (await api.get(path, tabB)).json());
    expect(detail.lease).toMatchObject({ heldByMe: false, holderName: "Asha Rao" });

    const spec = { version: 1, title: "Draft", scenes: [{ id: "sc_one", narration: "Hello." }] };
    const saved = await api.send("PUT", `${path}/draft`, { baseRev: 0, spec }, tabA);
    expect(saved.status()).toBe(200);
    expect(draftSavedDto.parse(await json(saved))).toMatchObject({
      rev: 1,
      staleSceneIds: [],
      issues: [],
    });

    const stale = await api.send("PUT", `${path}/draft`, { baseRev: 0, spec }, tabA);
    expect(stale.status()).toBe(409);
    expect((await json(stale)).error).toMatchObject({
      code: "REV_CONFLICT",
      details: { currentRev: 1 },
    });

    const notHolder = await api.send("PUT", `${path}/draft`, { baseRev: 1, spec }, tabB);
    expect(notHolder.status()).toBe(423);

    const takeover = await api.send("POST", `${path}/lease`, { takeover: true }, tabB);
    expect(takeover.status()).toBe(200);
    expect((await api.send("PUT", `${path}/draft`, { baseRev: 1, spec }, tabB)).status()).toBe(200);
    expect((await api.send("PUT", `${path}/draft`, { baseRev: 2, spec }, tabA)).status()).toBe(423);

    // The beacon on tab close: no custom headers, the editor id in the body.
    const release = await api.send("POST", `${path}/lease/release`, { editorId: "tab-b" });
    expect(release.status()).toBe(204);
    expect(projectDetailDto.parse(await (await api.get(path)).json()).lease).toBeNull();

    const missingEditor = await api.send("POST", `${path}/lease`, {});
    expect(missingEditor.status()).toBe(400);
    const badSpec = await api.send(
      "PUT",
      `${path}/draft`,
      { baseRev: 2, spec: { version: 2, scenes: [] } },
      tabA,
    );
    expect(badSpec.status()).toBe(400);

    // More than 10 scenes is a shape error: nothing is saved (API §5).
    const scenes = Array.from({ length: 11 }, (_, i) => ({ id: `sc_${i}`, narration: "Hi." }));
    const eleven = await api.send(
      "PUT",
      `${path}/draft`,
      { baseRev: 2, spec: { version: 1, scenes } },
      tabB,
    );
    expect(eleven.status()).toBe(400);
    expect((await json(eleven)).error.fields[0].path).toBe("spec.scenes");
  });

  test("update, delete, Trash, restore and duplicate", async ({ page }) => {
    const api = await apiFor(page, "api-trash");
    const project = await createProject(api, "Ladakh in 30 seconds", { notes: "Pangong" });
    const path = `/projects/${project.id}`;

    const patched = await api.send("PATCH", path, {
      title: "Ladakh trip reel",
      wizardStep: "idea",
      settings: { palette: "ocean" },
      idea: { notes: null },
    });
    expect(patched.status()).toBe(200);
    expect(projectDetailDto.parse(await json(patched))).toMatchObject({
      title: "Ladakh trip reel",
      wizardStep: "idea",
      settings: { palette: "ocean" },
      idea: { notes: null },
    });

    // No skipping ahead: a new project has nothing to show at the video step (D4).
    const jump = await api.send("PATCH", path, { wizardStep: "video" });
    expect(jump.status()).toBe(409);
    expect((await json(jump)).error).toMatchObject({
      code: "STAGE_INVALID",
      details: { stage: "draft", wizardStep: "idea", needs: "version" },
    });

    const noScript = await api.send("PATCH", path, { script: { text: "Hello" } });
    expect(noScript.status()).toBe(409);
    expect((await json(noScript)).error.code).toBe("STAGE_INVALID");
    expect((await api.send("PATCH", path, {})).status()).toBe(400);

    const noKey = await api.send("POST", `${path}/duplicate`);
    expect(noKey.status()).toBe(400);
    expect((await json(noKey)).error.fields[0].path).toBe("Idempotency-Key");
    const duplicateKey = key();
    const copy = await api.send("POST", `${path}/duplicate`, undefined, {
      "Idempotency-Key": duplicateKey,
    });
    expect(copy.status()).toBe(201);
    const twice = await api.send("POST", `${path}/duplicate`, undefined, {
      "Idempotency-Key": duplicateKey,
    });
    expect(twice.headers()["idempotent-replayed"]).toBe("true");
    expect(projectDetailDto.parse(await json(copy)).title).toBe("Ladakh trip reel (copy)");

    const deleted = await api.send("DELETE", path);
    expect(deleted.status()).toBe(204);
    expect(deleted.headers()["x-cancelled-posts"]).toBe("0");
    expect((await api.get(path)).status()).toBe(404);
    const trash = pageOf(projectSummaryDto).parse(
      await (await api.get("/projects?trash=true")).json(),
    );
    expect(trash.items.map((p) => p.id)).toEqual([project.id]);
    expect(trash.items[0]?.deletedAt).toEqual(expect.any(String));

    const restored = await api.send("POST", `${path}/restore`);
    expect(restored.status()).toBe(200);
    expect(projectDetailDto.parse(await json(restored)).deletedAt).toBeNull();
    expect((await api.send("POST", `${path}/restore`)).status()).toBe(404);
  });

  test("writes from another origin, and requests without a session, are refused", async ({
    page,
    request,
  }) => {
    const api = await apiFor(page, "api-origin");
    const foreign = await api.send(
      "POST",
      "/projects",
      { topic: "UPI" },
      {
        Origin: "https://evil.example",
        "Idempotency-Key": key(),
      },
    );
    expect(foreign.status()).toBe(403);
    expect((await json(foreign)).error.code).toBe("CSRF_ORIGIN");

    const anonymous = await request.get("/api/v1/projects");
    expect(anonymous.status()).toBe(401);
    expect(anonymous.headers()["cache-control"]).toBe("private, no-store");
  });
});
