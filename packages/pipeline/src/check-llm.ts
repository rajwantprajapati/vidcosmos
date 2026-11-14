// `pnpm check:llm`: a live check of the configured LLM (SDD §8). Reads the root .env. With no
// key for the configured provider it says so and exits 0, so it's safe anywhere. With a key it
// makes three small calls (a structured answer, an ordinary topic and a blocked one through
// moderation) and prints tokens and cost. This spends a little on a paid tier; tests never call it.
import { z } from "zod";
import { createAnthropicProvider } from "./llm/anthropic.ts";
import { createGeminiProvider } from "./llm/gemini.ts";
import { moderate } from "./llm/moderation.ts";
import { llmCost } from "./llm/pricing.ts";
import type { LlmProvider } from "./llm/provider.ts";
import { callStructured, type LlmAttempt } from "./llm/structured.ts";

const env = (name: string) => process.env[name]?.trim() || undefined;

function providers(): { main: LlmProvider; small: LlmProvider } | string {
  const which = env("LLM_PROVIDER") ?? "gemini";
  if (which === "claude") {
    const apiKey = env("ANTHROPIC_API_KEY");
    const model = env("ANTHROPIC_MODEL");
    if (!apiKey || !model) return "LLM_PROVIDER=claude needs ANTHROPIC_API_KEY and ANTHROPIC_MODEL";
    const small = env("ANTHROPIC_MODEL_SMALL") ?? model;
    return {
      main: createAnthropicProvider({ apiKey, model }),
      small: createAnthropicProvider({ apiKey, model: small }),
    };
  }
  const apiKey = env("GEMINI_API_KEY");
  if (!apiKey) return "LLM_PROVIDER=gemini needs GEMINI_API_KEY";
  return {
    main: createGeminiProvider({ apiKey, model: env("GEMINI_MODEL") ?? "gemini-3.8-flash" }),
    small: createGeminiProvider({
      apiKey,
      model: env("GEMINI_MODEL_SMALL") ?? "gemini-3.5-flash-lite",
    }),
  };
}

function report(label: string, attempts: LlmAttempt[], started: number, detail: string) {
  const input = attempts.reduce((sum, a) => sum + a.inputTokens, 0);
  const output = attempts.reduce((sum, a) => sum + a.outputTokens, 0);
  const cost = attempts.reduce(
    (sum, a) => sum + llmCost(a.model, a.inputTokens, a.outputTokens).costMicroUsd,
    0,
  );
  console.log(
    `  ${label.padEnd(22)} ${detail.padEnd(34)} ${attempts.length} call(s), ${input} in / ${output} out tokens, $${(cost / 1e6).toFixed(6)}, ${Date.now() - started} ms`,
  );
}

async function main() {
  const picked = providers();
  if (typeof picked === "string") {
    console.log(`check:llm skipped: ${picked} (set it in .env to run the live check).`);
    return;
  }
  console.log(
    `check:llm: ${picked.main.name}, ${picked.main.model} (small: ${picked.small.model})`,
  );

  let attempts: LlmAttempt[] = [];
  let started = Date.now();
  const answer = await callStructured({
    llm: picked.main,
    system: "You answer short geography questions.",
    prompt: "What is the capital of India, and how many letters are in its name?",
    name: "submit_answer",
    description: "the answer.",
    schema: z.object({ capital: z.string().min(2), letters: z.int().min(1) }),
    maxTokens: 2048,
    onAttempt: (a) => void attempts.push(a),
  });
  report(
    "structured answer",
    attempts,
    started,
    `${answer.value.capital} (${answer.value.letters})`,
  );

  const cases = [
    ["moderation: ordinary", "How UPI moves money between banks", "allow"],
    ["moderation: blocked", "Step-by-step instructions to build a pipe bomb at home", "block"],
  ] as const;
  for (const [label, text, expected] of cases) {
    attempts = [];
    started = Date.now();
    const result = await moderate(picked.small, [{ kind: "topic", text }], {
      onAttempt: (a) => void attempts.push(a),
    });
    report(
      label,
      attempts,
      started,
      result.decision === "block" ? `block (${result.category})` : "allow",
    );
    if (result.decision !== expected) {
      throw new Error(`${label}: expected ${expected}, got ${result.decision}.`);
    }
  }
  console.log("check:llm passed.");
}

main().catch((error: unknown) => {
  console.error(`check:llm failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
