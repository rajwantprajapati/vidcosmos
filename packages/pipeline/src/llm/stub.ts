// The stub LLM for `PROVIDERS=stub`: no keys, no cost, the same answer every time. Each output
// name has a handler; moderation's is built in, and later features add theirs (ideas, script,
// storyboard). The stub moderator refuses a few obvious phrases, so the blocked path can be
// tried and tested without a key.
import { ideasRequestLabel } from "../ideas.ts";
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

/** Stub angles: built from the topic, so they read sensibly in a demo. */
function anglesInStub(request: StructuredRequest) {
  const line = request.prompt.split(`${ideasRequestLabel}\n`)[1] ?? "{}";
  const data = JSON.parse(line) as { topic?: string };
  const count = Number(/exactly (\d+)/.exec(request.prompt)?.[1] ?? 4);
  const topic = (data.topic ?? "this topic").replace(/\s+/g, " ").trim();
  // Long topics are cut short; the hooks below never put a full stop after the cut.
  const subject = (topic.length > 48 ? topic.slice(0, 45).trimEnd() : topic).replace(/[.!?]+$/, "");
  const angles = [
    {
      title: "The step-by-step journey",
      hook: `Here is what really happens, one step at a time: ${subject}.`,
      outline: ["Where it starts", "What happens in the middle", "How it ends"],
    },
    {
      title: "Three myths, cleared up",
      hook: `Most people get this wrong. Let's clear up three myths about ${subject}.`,
      outline: ["The most common myth", "The one that sounds true", "What to remember"],
    },
    {
      title: "One person's story",
      hook: `Meet Asha. Her day shows ${subject} better than any diagram.`,
      outline: ["Asha's problem", "What she does", "What changed"],
    },
    {
      title: "Before and after",
      hook: `Compare life without it and with it, and ${subject} suddenly makes sense.`,
      outline: ["Before", "After", "Why the difference matters"],
    },
    {
      title: "Five quick tips",
      hook: `Five tips in under a minute, so ${subject} feels easy.`,
      outline: ["Tip one", "Tips two to four", "The tip most people skip"],
    },
  ];
  return { angles: angles.slice(0, count) };
}

/** A rough token count (4 characters a token), so stub usage looks plausible. */
const roughTokens = (text: string) => Math.ceil(text.length / 4);

export function createStubLlm(handlers: Record<string, StubHandler> = {}): LlmProvider {
  const all: Record<string, StubHandler> = {
    classify_content: classifyInStub,
    submit_angles: anglesInStub,
    ...handlers,
  };
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
