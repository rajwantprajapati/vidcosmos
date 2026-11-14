// F13: the app's moderator. A block is 422 CONTENT_BLOCKED with its category and is recorded;
// empty text isn't checked; and when moderation errors or is slow, the request goes ahead
// (API §5) without throwing.
import type { LlmProvider } from "@vidcosmos/pipeline";
import type * as DbModule from "@vidcosmos/db";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/env", () => ({ env: { BETTER_AUTH_URL: "http://localhost:3000" } }));
vi.mock("./auth", () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock("./db", () => ({ getDb: vi.fn(() => ({})) }));

const recordModeration = vi.fn(async () => ({ recorded: true, flagged: false }));
vi.mock("@vidcosmos/db", async (original) => ({
  ...(await original<typeof DbModule>()),
  recordModeration: (...args: unknown[]) => recordModeration(...(args as [])),
}));

let llm: LlmProvider;
const recordUsage = vi.fn(async () => {});
vi.mock("./llm", () => ({
  getLlm: () => llm,
  recordLlmUsage: () => recordUsage,
}));

const { createStubLlm } = await import("@vidcosmos/pipeline");
const { ObjectId } = await import("@vidcosmos/db");
const { requireAllowed } = await import("./moderation");
const { ApiError } = await import("./api");

const scope = { workspaceId: new ObjectId(), userId: new ObjectId() };

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  llm = createStubLlm();
});

describe("requireAllowed", () => {
  it("lets ordinary text through and skips empty text", async () => {
    await expect(
      requireAllowed(scope, [
        { kind: "topic", text: "How UPI moves money" },
        null,
        { kind: "notes", text: "  " },
      ]),
    ).resolves.toBeUndefined();
    expect(recordModeration).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ decision: "allow", inputKind: "topic" }),
    );
    recordModeration.mockClear();
    await requireAllowed(scope, [null, { kind: "notes", text: "" }]);
    expect(recordModeration).not.toHaveBeenCalled();
  });

  it("refuses a blocked input with 422 CONTENT_BLOCKED and its category, and records it", async () => {
    const error = await requireAllowed({ ...scope, projectId: new ObjectId() }, [
      { kind: "topic", text: "Chemistry at home" },
      { kind: "notes", text: "how to make a bomb" },
    ]).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      code: "CONTENT_BLOCKED",
      message: "Videos can't give instructions for making weapons or explosives.",
      details: { category: "illegal" },
    });
    expect(recordModeration).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        decision: "block",
        inputKind: "notes",
        category: "illegal",
        text: "how to make a bomb",
        projectId: expect.anything(),
      }),
    );
  });

  it("lets the request through when moderation fails", async () => {
    llm = { name: "gemini", model: "m", generate: async () => Promise.reject(new Error("503")) };
    await expect(requireAllowed(scope, [{ kind: "topic", text: "bomb" }])).resolves.toBeUndefined();
    expect(recordModeration).not.toHaveBeenCalled();
  });

  it("lets the request through when moderation takes too long", async () => {
    llm = { name: "gemini", model: "m", generate: () => new Promise(() => {}) };
    await expect(
      requireAllowed(scope, [{ kind: "topic", text: "bomb" }], { timeoutMs: 20 }),
    ).resolves.toBeUndefined();
  });

  it("still blocks when recording the decision fails", async () => {
    recordModeration.mockRejectedValueOnce(new Error("db down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      requireAllowed(scope, [{ kind: "topic", text: "nsfw clip" }]),
    ).rejects.toMatchObject({
      code: "CONTENT_BLOCKED",
      details: { category: "sexual" },
    });
  });
});
