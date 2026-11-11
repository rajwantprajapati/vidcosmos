// The provider registry. Each external service (LLM, voice, render, storage, Instagram,
// email) is added by its own feature with a stub and a live implementation:
//
//   const llm = selectProvider(env, "llm", {
//     stub: () => new StubLlm(),
//     live: (env) => new GeminiLlm(env.GEMINI_API_KEY!),
//   });
//
// In stub mode the live factory is never called, so live keys are never read.
import type { Env, ProviderName } from "./env-schema";

export type ProviderFactories<T> = {
  stub: () => T;
  live: (env: Env) => T;
};

export function selectProvider<T>(
  env: Env,
  name: ProviderName,
  factories: ProviderFactories<T>,
): T {
  return env.providers[name] === "live" ? factories.live(env) : factories.stub();
}
