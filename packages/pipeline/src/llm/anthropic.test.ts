// F13: the Claude provider with mocked HTTP: a JSON-schema structured output (no forced tool
// call), the server-side fallback on models that support it, refusals, retry with feedback,
// rate limits, and tokens and cost per attempt.
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createAnthropicProvider } from "./anthropic.ts";
import { llmCost } from "./pricing.ts";
import { type LlmAttempt, callStructured } from "./structured.ts";

type Sent = { url: string; headers: Headers; body: Record<string, unknown> };

function mockClaude(replies: Array<Record<string, unknown> | { status: number }>) {
  const sent: Sent[] = [];
  const fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    sent.push({
      url: String(url),
      headers: new Headers(init?.headers),
      body: JSON.parse(String(init?.body)),
    });
    const reply = replies[sent.length - 1]!;
    if ("status" in reply && typeof reply.status === "number") {
      return new Response(
        JSON.stringify({
          type: "error",
          error: { type: "rate_limit_error", message: "slow down" },
        }),
        {
          status: reply.status,
          headers: { "content-type": "application/json" },
        },
      );
    }
    return new Response(JSON.stringify(reply), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof globalThis.fetch;
  return { sent, fetch };
}

const message = (output: unknown, extra: Record<string, unknown> = {}) => ({
  id: "msg_1",
  type: "message",
  role: "assistant",
  model: "claude-sonnet-5-5",
  content: [{ type: "text", text: JSON.stringify(output) }],
  stop_reason: "end_turn",
  stop_sequence: null,
  usage: { input_tokens: 1000, output_tokens: 500 },
  ...extra,
});

const answer = z.object({ title: z.string().min(3).max(60), count: z.int().min(1) });

describe("Claude provider", () => {
  it("asks for JSON output with a Claude-safe schema and the default fallback", async () => {
    const { sent, fetch } = mockClaude([message({ title: "How UPI works", count: 3 })]);
    const llm = createAnthropicProvider({
      apiKey: "test-key",
      model: "claude-sonnet-5-5",
      fetch,
      maxRetries: 0,
    });
    const attempts: LlmAttempt[] = [];
    const result = await callStructured({
      llm,
      system: "You write titles.",
      prompt: "A title about UPI.",
      name: "submit_title",
      description: "the title.",
      schema: answer,
      effort: "low",
      onAttempt: (a) => void attempts.push(a),
    });

    expect(result.value).toEqual({ title: "How UPI works", count: 3 });
    const { url, headers, body } = sent[0]!;
    expect(url).toContain("/v1/messages");
    // SDK 1.x sends the key as a bearer token, with API version 2026-10-21.
    expect(headers.get("authorization")).toBe("Bearer test-key");
    expect(headers.get("anthropic-beta")).toContain("server-side-fallback-2026-07-01");
    expect(body.fallbacks).toBe("default");
    expect(body.model).toBe("claude-sonnet-5-5");
    expect(body).not.toHaveProperty("tool_choice");
    expect(body).not.toHaveProperty("tools");
    const config = body.output_config as {
      format: { type: string; schema: Record<string, unknown> };
      effort: string;
    };
    expect(config.effort).toBe("low");
    expect(config.format.type).toBe("json_schema");
    const schema = JSON.stringify(config.format.schema);
    expect(schema).toContain('"additionalProperties":false');
    expect(schema).not.toMatch(/minLength|maxLength|minimum|\$schema/);
    expect(String(body.system)).toContain("Respond with one JSON object: the title.");

    expect(attempts).toEqual([
      {
        provider: "anthropic",
        model: "claude-sonnet-5-5",
        inputTokens: 1000,
        outputTokens: 500,
        attempt: 1,
      },
    ]);
    // $2 / $10 per million tokens: 1000 × 2 + 500 × 10 micro-dollars.
    expect(llmCost("claude-sonnet-5-5", 1000, 500)).toEqual({
      costMicroUsd: 7000,
      priceVersion: "2026-11",
    });
  });

  it("doesn't send the fallback to models without it", async () => {
    const { sent, fetch } = mockClaude([
      message({ title: "Okay title", count: 1 }, { model: "claude-haiku-5-5" }),
    ]);
    const llm = createAnthropicProvider({
      apiKey: "k",
      model: "claude-haiku-5-5",
      fetch,
      maxRetries: 0,
    });
    await callStructured({
      llm,
      system: "s",
      prompt: "p",
      name: "n",
      description: "d",
      schema: answer,
    });
    expect(sent[0]!.body).not.toHaveProperty("fallbacks");
    expect(sent[0]!.headers.get("anthropic-beta") ?? "").not.toContain("server-side-fallback");
  });

  it("checks with zod what the schema couldn't, and asks again with the problems", async () => {
    const { sent, fetch } = mockClaude([
      message({ title: "Up", count: 0 }),
      message({ title: "How UPI works", count: 2 }),
    ]);
    const llm = createAnthropicProvider({
      apiKey: "k",
      model: "claude-sonnet-5-5",
      fetch,
      maxRetries: 0,
    });
    const result = await callStructured({
      llm,
      system: "s",
      prompt: "A title.",
      name: "n",
      description: "d",
      schema: answer,
    });
    expect(result.attempts).toBe(2);
    const retry = JSON.stringify(sent[1]!.body.messages);
    expect(retry).toContain("It had these problems");
    expect(retry).toMatch(/title/);
    expect(retry).toMatch(/count/);
  });

  it("turns a refusal into CONTENT_BLOCKED, after recording its tokens", async () => {
    const { fetch } = mockClaude([
      message(null, {
        content: [],
        stop_reason: "refusal",
        stop_details: { type: "refusal", category: "cyber" },
      }),
    ]);
    const llm = createAnthropicProvider({
      apiKey: "k",
      model: "claude-sonnet-5-5",
      fetch,
      maxRetries: 0,
    });
    const attempts: LlmAttempt[] = [];
    await expect(
      callStructured({
        llm,
        system: "s",
        prompt: "p",
        name: "n",
        description: "d",
        schema: answer,
        onAttempt: (a) => void attempts.push(a),
      }),
    ).rejects.toMatchObject({
      code: "CONTENT_BLOCKED",
      retryable: false,
      message: expect.stringContaining("cyber"),
    });
    expect(attempts).toHaveLength(1);
  });

  it("reports a rate limit as LLM_RATE_LIMITED", async () => {
    const { fetch } = mockClaude([{ status: 429 }]);
    const llm = createAnthropicProvider({
      apiKey: "k",
      model: "claude-sonnet-5-5",
      fetch,
      maxRetries: 0,
    });
    await expect(
      callStructured({
        llm,
        system: "s",
        prompt: "p",
        name: "n",
        description: "d",
        schema: answer,
      }),
    ).rejects.toMatchObject({ code: "LLM_RATE_LIMITED" });
  });
});
