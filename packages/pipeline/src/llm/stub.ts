// The stub LLM for `PROVIDERS=stub`: no keys, no cost, the same answer every time. Each output
// name has a handler; moderation's is built in, and later features add theirs (ideas, script,
// storyboard). The stub moderator refuses a few obvious phrases, so the blocked path can be
// tried and tested without a key.
import { ideasRequestLabel } from "../ideas.ts";
import { scriptRequestLabel } from "../script.ts";
import type { LlmProvider, StructuredRequest } from "./provider.ts";
import {
  type ContentClassification,
  type ModerationCategory,
  moderationTextsLabel,
} from "./moderation.ts";

/**
 * The one line of JSON after `label`. A retry adds the problems found below it (see
 * `callStructured`), so only that line is the request.
 */
function jsonLine(prompt: string, label: string): string | undefined {
  return prompt.split(`${label}\n`)[1]?.split("\n")[0];
}

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
  const line = jsonLine(prompt, moderationTextsLabel) ?? "[]";
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
  const line = jsonLine(request.prompt, ideasRequestLabel) ?? "{}";
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

/** The request JSON a script prompt carries after its label. */
function scriptData<T>(prompt: string): T {
  return JSON.parse(jsonLine(prompt, scriptRequestLabel) ?? "{}") as T;
}

const words = (text: string) => text.split(/\s+/).filter(Boolean).length;

/** Sentences the stub script is made of, per language, after the hook. */
const stubSentences = {
  en: [
    "First, it helps to know where it all starts.",
    "Most of the work happens in a few simple steps that repeat every time.",
    "Each step hands its result to the next one, so nothing gets lost on the way.",
    "That is why it feels instant, even though a lot is going on behind the scenes.",
    "Here is a small example from everyday life that shows how it works.",
    "When something goes wrong, there is usually a safe way back.",
    "People often think it is complicated, but the idea underneath is simple.",
    "Once you see the pattern, you will notice it everywhere.",
  ],
  hi: [
    "सबसे पहले यह जानना ज़रूरी है कि सब कुछ कहाँ से शुरू होता है।",
    "ज़्यादातर काम कुछ आसान कदमों में होता है जो हर बार दोहराए जाते हैं।",
    "हर कदम अपना नतीजा अगले कदम को देता है, इसलिए रास्ते में कुछ नहीं खोता।",
    "इसीलिए यह तुरंत लगता है, भले ही पीछे बहुत कुछ चल रहा हो।",
    "रोज़ की ज़िंदगी का एक छोटा सा उदाहरण इसे साफ़ दिखाता है।",
    "जब कुछ गड़बड़ होती है, तो वापस लौटने का एक सुरक्षित रास्ता होता है।",
  ],
} as const;

/** A stub script of about the asked-for length, built from the topic or the angle's hook. */
function scriptInStub(request: StructuredRequest) {
  const target = Number(/about (\d+) words/.exec(request.prompt)?.[1] ?? 150);
  const data = scriptData<{
    topic?: string;
    angle?: { title: string; hook: string };
    narrationLanguage?: string;
  }>(request.prompt);
  const hindi = (data.narrationLanguage ?? "").startsWith("Hindi");
  const topic = (data.topic ?? "this topic").replace(/\s+/g, " ").trim();
  const subject = (topic.length > 48 ? topic.slice(0, 45).trimEnd() : topic).replace(/[.!?]+$/, "");
  const hook =
    data.angle?.hook ??
    (hindi ? `आइए समझते हैं: ${subject}।` : `Let's look at ${subject}, one step at a time.`);
  const recap = hindi
    ? "बस इतना याद रखिए, और अगली बार यह आपको आसान लगेगा।"
    : "Remember that, and next time it will feel easy.";
  const pool = stubSentences[hindi ? "hi" : "en"];
  const filler = hindi ? "बस इतनी सी बात है।" : "That is all it takes.";
  const body: string[] = [];
  let count = words(hook) + words(recap);
  // Whole sentences while they fit, then short ones to land within a few words of the target.
  for (let i = 0; i < 40 && count + words(pool[i % pool.length]!) <= target; i += 1) {
    body.push(pool[i % pool.length]!);
    count += words(pool[i % pool.length]!);
  }
  while (count < target - 3) {
    body.push(filler);
    count += words(filler);
  }
  // Paragraphs of three sentences between the hook and the recap.
  const paragraphs = [hook];
  for (let i = 0; i < body.length; i += 3) paragraphs.push(body.slice(i, i + 3).join(" "));
  paragraphs.push(recap);
  return {
    title: data.angle?.title ?? (subject.length > 3 ? subject : "Your video"),
    script: paragraphs.join("\n\n"),
  };
}

/** A visible, predictable rewrite of the part asked for (or the whole script). */
function rewriteInStub(request: StructuredRequest) {
  const data = scriptData<{
    instruction?: string;
    script?: string;
    selectedPart?: string;
  }>(request.prompt);
  const text = (data.selectedPart ?? data.script ?? "").trim();
  const sentences = text.match(/[^.!?।]+[.!?।]+["”’]*|[^.!?।]+$/gu)?.map((s) => s.trim()) ?? [text];
  switch (data.instruction) {
    case "shorter": {
      if (sentences.length > 1) {
        const keep = Math.max(1, Math.floor(sentences.length * 0.75));
        return { text: sentences.slice(0, keep).join(" ") };
      }
      const all = text.split(/\s+/);
      return { text: all.slice(0, Math.max(1, Math.floor(all.length * 0.75))).join(" ") };
    }
    case "longer":
      return { text: `${text} Here is one more example that makes it concrete.` };
    case "simpler":
      return {
        text: text.replace(/, (\p{L})/gu, (_, letter: string) => `. ${letter.toUpperCase()}`),
      };
    case "more_engaging":
      return { text: `Picture this. ${text}` };
    case "more_formal":
      return {
        text: text
          .replace(/\bLet's\b/g, "Let us")
          .replace(/\bit's\b/g, "it is")
          .replace(/\bdon't\b/g, "do not")
          .replace(/\bcan't\b/g, "cannot"),
      };
    default:
      return { text: `${text} That is the key idea.` };
  }
}

/** A rough token count (4 characters a token), so stub usage looks plausible. */
const roughTokens = (text: string) => Math.ceil(text.length / 4);

export function createStubLlm(handlers: Record<string, StubHandler> = {}): LlmProvider {
  const all: Record<string, StubHandler> = {
    classify_content: classifyInStub,
    submit_angles: anglesInStub,
    submit_script: scriptInStub,
    submit_rewrite: rewriteInStub,
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
