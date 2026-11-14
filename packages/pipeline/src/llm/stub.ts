// The stub LLM for `PROVIDERS=stub`: no keys, no cost, the same answer every time. Each output
// name has a handler; moderation's is built in, and later features add theirs (ideas, script,
// storyboard). The stub moderator refuses a few obvious phrases, so the blocked path can be
// tried and tested without a key.
import type { LlmProvider, StructuredRequest } from "./provider.ts";
import {
  type ContentClassification,
  type ModerationCategory,
  moderationTextsLabel,
} from "./moderation.ts";

export type StubHandler = (request: StructuredRequest) => unknown;

/** What the stub moderator refuses (documented in STATUS.md, for manual testing). */
export const stubBlockedPhrases: {
  pattern: RegExp;
  category: ModerationCategory;
  reason: string;
}[] = [
  {
    pattern: /\b(bomb|explosives?)\b/i,
    category: "illegal",
    reason: "Videos can't give instructions for making weapons or explosives.",
  },
  {
    pattern: /\b(porn|nsfw|nude)\b/i,
    category: "sexual",
    reason: "Videos can't contain sexual content.",
  },
];

/** The texts moderation sent: the JSON line after its label (see `moderationPrompt`). */
function moderationTexts(prompt: string): { index: number; text: string }[] {
  const line = prompt.split(`${moderationTextsLabel}\n`)[1] ?? "[]";
  return JSON.parse(line) as { index: number; text: string }[];
}

function classifyInStub(request: StructuredRequest): ContentClassification {
  for (const { index, text } of moderationTexts(request.prompt)) {
    const hit = stubBlockedPhrases.find((p) => p.pattern.test(text));
    if (hit) {
      return {
        allowed: false,
        category: hit.category,
        reason: hit.reason,
        inputIndex: Number(index),
      };
    }
  }
  return { allowed: true, category: "none", reason: "", inputIndex: -1 };
}

/** A rough token count (4 characters a token), so stub usage looks plausible. */
const roughTokens = (text: string) => Math.ceil(text.length / 4);

export function createStubLlm(handlers: Record<string, StubHandler> = {}): LlmProvider {
  const all: Record<string, StubHandler> = { classify_content: classifyInStub, ...handlers };
  return {
    name: "stub",
    model: "stub",
    async generate(request) {
      const handler = all[request.name];
      if (!handler) throw new Error(`The stub LLM has no answer for "${request.name}" yet.`);
      const output = handler(request);
      return {
        output,
        model: "stub",
        inputTokens: roughTokens(request.system + request.prompt),
        outputTokens: roughTokens(JSON.stringify(output)),
      };
    },
  };
}
