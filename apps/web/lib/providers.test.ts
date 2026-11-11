import { describe, expect, it, vi } from "vitest";
import { parseEnv } from "./env-schema";
import { selectProvider } from "./providers";

const base = {
  MONGODB_URI: "mongodb://localhost:27017/vidcosmos",
  BETTER_AUTH_SECRET: "test-secret-that-is-at-least-32-chars-long",
};

describe("selectProvider", () => {
  it("returns the stub in stub mode and never calls the live factory", () => {
    const env = parseEnv({ ...base, PROVIDERS: "stub" });
    const live = vi.fn(() => "live");
    expect(selectProvider(env, "llm", { stub: () => "stub", live })).toBe("stub");
    expect(live).not.toHaveBeenCalled();
  });

  it("returns the live implementation, with the env, when that provider is live", () => {
    const env = parseEnv({
      ...base,
      PROVIDERS: "stub",
      PROVIDERS_LLM: "live",
      GEMINI_API_KEY: "g",
    });
    const stub = vi.fn(() => "stub");
    const live = vi.fn(() => "live");
    expect(selectProvider(env, "llm", { stub, live })).toBe("live");
    expect(live).toHaveBeenCalledWith(env);
    expect(stub).not.toHaveBeenCalled();
    expect(selectProvider(env, "tts", { stub, live: () => "live" })).toBe("stub");
  });
});
