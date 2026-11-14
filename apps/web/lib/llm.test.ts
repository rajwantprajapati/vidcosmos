// F13: each live LLM call becomes a usage event with its cost; the stub records nothing; a failed
// write never fails the request.
import type * as DbModule from "@vidcosmos/db";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/env", () => ({ env: { providers: { llm: "stub" } } }));
vi.mock("./db", () => ({ getDb: vi.fn(() => ({})) }));
const recordUsage = vi.fn(async () => {});
vi.mock("@vidcosmos/db", async (original) => ({
  ...(await original<typeof DbModule>()),
  recordUsage: (...args: unknown[]) => recordUsage(...(args as [])),
}));

const { getLlm, recordLlmUsage } = await import("./llm");
const { ObjectId } = await import("@vidcosmos/db");

beforeEach(() => vi.clearAllMocks());

describe("LLM usage events", () => {
  const scope = { workspaceId: new ObjectId(), userId: new ObjectId() };

  it("records a live call with its priced cost and attempt", async () => {
    await recordLlmUsage(
      scope,
      "moderation",
    )({
      provider: "anthropic",
      model: "claude-haiku-5-5",
      inputTokens: 10_000,
      outputTokens: 1_000,
      attempt: 2,
    });
    expect(recordUsage).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        ...scope,
        provider: "anthropic",
        operation: "moderation",
        model: "claude-haiku-5-5",
        units: { inputTokens: 10_000, outputTokens: 1_000 },
        cached: false,
        costMicroUsd: 1500,
        priceVersion: "2026-11",
        attempt: 2,
      }),
    );
  });

  it("records nothing for the stub, and swallows a failed write", async () => {
    await recordLlmUsage(
      scope,
      "ideas",
    )({ provider: "stub", model: "stub", inputTokens: 1, outputTokens: 1, attempt: 1 });
    expect(recordUsage).not.toHaveBeenCalled();
    recordUsage.mockRejectedValueOnce(new Error("db down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      recordLlmUsage(
        scope,
        "ideas",
      )({
        provider: "gemini",
        model: "gemini-3.8-flash",
        inputTokens: 1,
        outputTokens: 1,
        attempt: 1,
      }),
    ).resolves.toBeUndefined();
  });

  it("uses the stub with PROVIDERS=stub", () => {
    expect(getLlm("small")).toMatchObject({ name: "stub", model: "stub" });
  });
});
