// F20: the voice service. ElevenLabs' character timings grouped into words, its errors sorted
// into ones worth retrying and ones that aren't, and the stub's silent audio and word timings.
import { describe, expect, it } from "vitest";
import {
  createElevenLabsTts,
  createStubTts,
  mp3DurationMs,
  silentMp3,
  TtsError,
  wordsFromCharacters,
} from "./tts.ts";

const request = {
  text: "You tap Pay.",
  language: "en" as const,
  voiceId: "voice_1",
  model: "eleven_multilingual_v2",
  speed: 1,
};

describe("wordsFromCharacters", () => {
  it("groups characters into words at whitespace", () => {
    const chars = [..."Hi  you"];
    const words = wordsFromCharacters({
      characters: chars,
      character_start_times_seconds: chars.map((_, i) => i * 0.1),
      character_end_times_seconds: chars.map((_, i) => i * 0.1 + 0.08),
    });
    expect(words).toEqual([
      { text: "Hi", startMs: 0, endMs: 180 },
      { text: "you", startMs: 400, endMs: 680 },
    ]);
  });
});

describe("ElevenLabs", () => {
  const reply = (status: number, body: unknown) =>
    (async () =>
      new Response(typeof body === "string" ? body : JSON.stringify(body), {
        status,
      })) as unknown as typeof fetch;

  it("asks for timestamps and returns the audio, its length and words", async () => {
    let asked: { url: string; body: Record<string, unknown> } | null = null;
    const chars = [..."You tap Pay."];
    const audio = new Uint8Array(16_000); // 1 s at 128 kbit/s
    const tts = createElevenLabsTts({
      apiKey: "key",
      fetch: (async (url: string, init: RequestInit) => {
        asked = { url, body: JSON.parse(String(init.body)) as Record<string, unknown> };
        return new Response(
          JSON.stringify({
            audio_base64: Buffer.from(audio).toString("base64"),
            alignment: {
              characters: chars,
              character_start_times_seconds: chars.map((_, i) => i * 0.05),
              character_end_times_seconds: chars.map((_, i) => i * 0.05 + 0.04),
            },
          }),
        );
      }) as unknown as typeof fetch,
    });
    const speech = await tts.synthesize(request);
    expect(asked!.url).toContain("/v1/text-to-speech/voice_1/with-timestamps");
    expect(asked!.url).toContain("output_format=mp3_44100_128");
    expect(asked!.body).toMatchObject({ model_id: "eleven_multilingual_v2", language_code: "en" });
    expect(speech.words.map((w) => w.text)).toEqual(["You", "tap", "Pay."]);
    expect(speech.durationMs).toBe(1000);
    expect(speech.characters).toBe(12);
    expect(speech.timingSource).toBe("provider");
  });

  it("sorts errors into ones to retry and ones that won't change", async () => {
    const fail = async (status: number, body = "") =>
      createElevenLabsTts({ apiKey: "k", fetch: reply(status, body) })
        .synthesize(request)
        .catch((error: unknown) => error as TtsError);
    expect(await fail(401)).toMatchObject({ code: "TTS_AUTH", retryable: false });
    expect(await fail(404, "voice_not_found")).toMatchObject({
      code: "TTS_VOICE",
      retryable: false,
    });
    expect(await fail(429)).toMatchObject({ code: "TTS_RATE_LIMIT", retryable: true });
    expect(await fail(422)).toMatchObject({ code: "TTS_REJECTED", retryable: false });
    expect(await fail(503)).toMatchObject({ code: "TTS_FAILED", retryable: true });
    expect(await fail(200, "not json")).toMatchObject({ code: "TTS_FAILED", retryable: true });
    const offline = await createElevenLabsTts({
      apiKey: "k",
      fetch: (async () => {
        throw new Error("offline");
      }) as unknown as typeof fetch,
    })
      .synthesize(request)
      .catch((error: unknown) => error as TtsError);
    expect(offline).toMatchObject({ code: "TTS_FAILED", retryable: true });
  });

  it("works out the length from the bytes, never shorter than the last word", () => {
    expect(mp3DurationMs(32_000, [])).toBe(2000);
    expect(mp3DurationMs(16_000, [{ text: "x", startMs: 0, endMs: 1500 }])).toBe(1500);
  });
});

describe("the stub voice", () => {
  it("spaces words at the speaking rate and returns silent audio as long as them", async () => {
    const speech = await createStubTts().synthesize({ ...request, text: "One two three four" });
    expect(speech.words.map((w) => w.startMs)).toEqual([0, 400, 800, 1200]);
    expect(speech.durationMs).toBe(1600);
    expect(speech.timingSource).toBe("estimated");
    // Whole MP3 frames that start with a frame header, covering the length.
    expect(speech.audio[0]).toBe(0xff);
    expect(speech.audio.length % 417).toBe(0);
    expect(mp3DurationMs(speech.audio.length, [])).toBeGreaterThanOrEqual(1600);
    const hindi = await createStubTts().synthesize({ ...request, language: "hi", text: "एक दो" });
    expect(hindi.words[1]!.startMs).toBe(Math.round(1000 / 2.2));
  });

  it("can be told to fail a request", async () => {
    const tts = createStubTts({
      failWith: (r) =>
        r.text.includes("fail") ? new TtsError("TTS_FAILED", "down", 503, true) : null,
    });
    await expect(tts.synthesize({ ...request, text: "please fail" })).rejects.toMatchObject({
      code: "TTS_FAILED",
    });
    await expect(tts.synthesize(request)).resolves.toBeTruthy();
  });

  it("makes silent audio in whole frames", () => {
    expect(silentMp3(0).length).toBe(417);
    expect(silentMp3(1000).length).toBe(Math.ceil(1000 / ((1152 / 44_100) * 1000)) * 417);
  });
});
