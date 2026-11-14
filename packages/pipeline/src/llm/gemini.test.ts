// F13: the Gemini provider with mocked HTTP: request shape (JSON schema, system instruction,
// thinking level), retry with the problems fed back, 429 waits, safety stops, tokens and cost.
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createGeminiProvider } from "./gemini.ts";
import { llmCost } from "./pricing.ts";
import { type LlmAttempt, callStructured } from "./structured.ts";

type Sent = { url: string; body: Record<string, unknown> };

/** Answers each Gemini request with the next reply; records what was sent. */
function mockGemini(replies: Array<unknown | { status: number }>) {
  const sent: Sent[] = [];
  vi.stubGlobal("fetch", async (url: string | URL | Request, init?: RequestInit) => {
    sent.push({ url: String(url), body: JSON.parse(String(init?.body)) });
    const reply = replies[sent.length - 1];
    if (reply && typeof reply === "object" && "status" in reply) {
      return new Response(JSON.stringify({ error: { code: reply.status, message: "busy" } }), {
        status: reply.status as number,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response(
      JSON.stringify({
        candidates: [
          {
            content: { role: "model", parts: [{ text: JSON.stringify(reply) }] },
            finishReason: "STOP",
          },
        ],
        usageMetadata: {
          promptTokenCount: 1200,
          candidatesTokenCount: 800,
          thoughtsTokenCount: 300,
        },
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  });
  return sent;
}

afterEach(() => vi.unstubAllGlobals());

const capital = z.object({
  kind: z.literal("answer"),
  capital: z.string().min(2),
  choice: z.union([z.literal("a"), z.literal("b")]),
});

const gemini = () =>
  createGeminiProvider({ apiKey: "test-key", model: "gemini-3.8-flash", retryWaitsMs: [0, 0] });

describe("Gemini provider", () => {
  it("sends a JSON-schema request with the system instruction and thinking level", async () => {
    const sent = mockGemini([{ kind: "answer", capital: "New Delhi", choice: "a" }]);
    const attempts: LlmAttempt[] = [];
    const result = await callStructured({
      llm: gemini(),
      system: "You answer geography questions.",
      prompt: "What is the capital of India?",
      name: "submit_answer",
      description: "the answer.",
      schema: capital,
      effort: "low",
      onAttempt: (a) => void attempts.push(a),
    });

    expect(result).toEqual({
      value: { kind: "answer", capital: "New Delhi", choice: "a" },
      attempts: 1,
      issues: [],
    });
    expect(sent).toHaveLength(1);
    expect(sent[0]!.url).toContain("models/gemini-3.8-flash:generateContent");
    const { generationConfig, systemInstruction, contents } = sent[0]!.body as {
      generationConfig: Record<string, unknown>;
      systemInstruction: unknown;
      contents: unknown;
    };
    expect(generationConfig.responseMimeType).toBe("application/json");
    expect(generationConfig.thinkingConfig).toEqual({ thinkingLevel: "LOW" });
    const schema = JSON.stringify(generationConfig.responseJsonSchema);
    expect(schema).not.toMatch(/"const"|"oneOf"|"\$schema"/);
    expect(schema).toContain('"enum":["answer"]');
    expect(JSON.stringify(systemInstruction)).toContain(
      "Respond with one JSON object: the answer.",
    );
    expect(JSON.stringify(contents)).toContain("What is the capital of India?");

    // Thinking tokens count as output.
    expect(attempts).toEqual([
      {
        provider: "gemini",
        model: "gemini-3.8-flash",
        inputTokens: 1200,
        outputTokens: 1100,
        attempt: 1,
      },
    ]);
    expect(llmCost("gemini-3.8-flash", 1200, 1100).costMicroUsd).toBe(0);
  });

  it("asks again with the previous answer and its problems, and reports every attempt", async () => {
    const sent = mockGemini([
      { kind: "answer", capital: "X", choice: "c" },
      { kind: "answer", capital: "New Delhi", choice: "b" },
    ]);
    const attempts: number[] = [];
    const result = await callStructured({
      llm: gemini(),
      system: "s",
      prompt: "What is the capital of India?",
      name: "submit_answer",
      description: "the answer.",
      schema: capital,
      onAttempt: (a) => void attempts.push(a.attempt),
    });
    expect(result.attempts).toBe(2);
    expect(result.issues.join("\n")).toMatch(/attempt 1: capital/);
    expect(attempts).toEqual([1, 2]);
    const retry = JSON.stringify(sent[1]!.body.contents);
    expect(retry).toContain("Your previous answer was");
    expect(retry).toContain("It had these problems");
    expect(retry).toContain("choice");
  });

  it("feeds semantic problems back too, and gives up after 3 invalid answers", async () => {
    mockGemini([
      { kind: "answer", capital: "Mumbai", choice: "a" },
      { kind: "answer", capital: "New Delhi", choice: "a" },
    ]);
    const checked = await callStructured({
      llm: gemini(),
      system: "s",
      prompt: "p",
      name: "submit_answer",
      description: "d",
      schema: capital,
      semanticCheck: (v) => (v.capital === "New Delhi" ? [] : ["capital: that isn't the capital."]),
    });
    expect(checked.value.capital).toBe("New Delhi");

    mockGemini([{ wrong: 1 }, { wrong: 2 }, { wrong: 3 }]);
    await expect(
      callStructured({
        llm: gemini(),
        system: "s",
        prompt: "p",
        name: "submit_answer",
        description: "d",
        schema: capital,
      }),
    ).rejects.toMatchObject({ code: "LLM_INVALID_OUTPUT", retryable: true });
  });

  it("waits and tries again on 429 and 5xx, then fails with a rate-limit error", async () => {
    const sent = mockGemini([
      { status: 429 },
      { status: 503 },
      { kind: "answer", capital: "Delhi", choice: "a" },
    ]);
    const ok = await callStructured({
      llm: gemini(),
      system: "s",
      prompt: "p",
      name: "n",
      description: "d",
      schema: capital,
    });
    expect(ok.value.capital).toBe("Delhi");
    expect(sent).toHaveLength(3);

    mockGemini([{ status: 429 }, { status: 429 }, { status: 429 }]);
    await expect(
      callStructured({
        llm: gemini(),
        system: "s",
        prompt: "p",
        name: "n",
        description: "d",
        schema: capital,
      }),
    ).rejects.toMatchObject({ code: "LLM_RATE_LIMITED", retryable: true });
  });

  it("treats a safety stop as a refusal", async () => {
    vi.stubGlobal(
      "fetch",
      async () =>
        new Response(
          JSON.stringify({
            candidates: [{ finishReason: "SAFETY" }],
            usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 0 },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    );
    await expect(
      callStructured({
        llm: gemini(),
        system: "s",
        prompt: "p",
        name: "n",
        description: "d",
        schema: capital,
      }),
    ).rejects.toMatchObject({ code: "CONTENT_BLOCKED", retryable: false });
  });
});
