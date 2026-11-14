// The price table for LLM calls (SDD §15 "Cost tracking"). Costs are integer micro-dollars
// (DB §4: 1 USD = 1,000,000), and every usage event records `priceVersion`, so old events keep
// the prices they were made at. A new price is a new version: copy the table, don't edit it.
//
// 1 USD per million tokens is exactly 1 micro-dollar per token, so cost = tokens × price.

export const llmPriceVersion = "2026-11";

type Price = {
  /** USD per million input and output tokens. */
  input: number;
  output: number;
  /** Prompts over this many tokens are billed at `long` prices (Claude Haiku 5.5). */
  longOver?: number;
  long?: { input: number; output: number };
};

const prices: Record<string, Price> = {
  // Gemini's free tier costs nothing; the events still record real token counts (DB §4).
  "gemini-3.8-flash": { input: 0, output: 0 },
  "gemini-3.5-flash-lite": { input: 0, output: 0 },
  // Anthropic list prices.
  "claude-opus-5-5": { input: 4, output: 20 },
  "claude-sonnet-5-5": { input: 2, output: 10 },
  "claude-sonnet-5": { input: 2, output: 10 },
  "claude-opus-5": { input: 5, output: 25 },
  "claude-haiku-5-5": {
    input: 0.1,
    output: 0.5,
    longOver: 100_000,
    long: { input: 0.5, output: 2.5 },
  },
};

export type LlmCost = { costMicroUsd: number; priceVersion: string };

/** What a call cost. A model missing from the table costs 0 and is marked `…:unpriced`. */
export function llmCost(model: string, inputTokens: number, outputTokens: number): LlmCost {
  const price = prices[model];
  if (!price) return { costMicroUsd: 0, priceVersion: `${llmPriceVersion}:unpriced` };
  const rate = price.long && price.longOver && inputTokens > price.longOver ? price.long : price;
  return {
    costMicroUsd: Math.round(inputTokens * rate.input + outputTokens * rate.output),
    priceVersion: llmPriceVersion,
  };
}
