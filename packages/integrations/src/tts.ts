// The narrator's voice (SDD §8 "Narration step", PRD FR-5.1): one interface, ElevenLabs for
// live and a stub for development and tests.
//
// ElevenLabs `with-timestamps` returns the MP3 and each character's start and end; characters
// are grouped into words (ported from the prototype), which is what triggers and captions use.
// The stub sends nothing and costs nothing: silent MP3 audio as long as the words would take at
// the language's speaking rate, with word timings to match, so a whole video plays without keys.

export type SpokenWordTiming = { text: string; startMs: number; endMs: number };

export type SpeechRequest = {
  /** What the narrator says. */
  text: string;
  language: "en" | "hi";
  /** ElevenLabs voice id. */
  voiceId: string;
  /** ElevenLabs model id, e.g. `eleven_multilingual_v2`. */
  model: string;
  /** 0.85-1.15 (DB §6). */
  speed: number;
};

export type Speech = {
  /** MP3 bytes. */
  audio: Uint8Array;
  mime: "audio/mpeg";
  durationMs: number;
  words: SpokenWordTiming[];
  /** Billed characters. */
  characters: number;
  /** `estimated` only from the stub. */
  timingSource: "provider" | "estimated";
};

export interface TtsProvider {
  readonly provider: "elevenlabs" | "stub";
  synthesize(request: SpeechRequest): Promise<Speech>;
}

export type TtsErrorCode =
  /** The key is missing or refused (401): retrying won't help. */
  | "TTS_AUTH"
  /** The voice isn't on the account (404). */
  | "TTS_VOICE"
  /** Too many requests or the account is out of characters (429). */
  | "TTS_RATE_LIMIT"
  /** The text was refused (400, 422). */
  | "TTS_REJECTED"
  /** Anything else: a 5xx, a network error, a response we can't read. */
  | "TTS_FAILED";

export class TtsError extends Error {
  readonly code: TtsErrorCode;
  readonly status: number | null;
  /** Whether trying again may work (5xx, rate limits, network). */
  readonly retryable: boolean;
  constructor(code: TtsErrorCode, message: string, status: number | null, retryable: boolean) {
    super(message);
    this.name = "TtsError";
    this.code = code;
    this.status = status;
    this.retryable = retryable;
  }
}

export const isTtsError = (error: unknown): error is TtsError => error instanceof TtsError;

type Alignment = {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
};

/** Groups ElevenLabs character timings into words, split at whitespace. */
export function wordsFromCharacters(alignment: Alignment): SpokenWordTiming[] {
  const words: SpokenWordTiming[] = [];
  let current: SpokenWordTiming | null = null;
  alignment.characters.forEach((ch, i) => {
    if (/\s/.test(ch)) {
      if (current) words.push(current);
      current = null;
      return;
    }
    const start = Math.round((alignment.character_start_times_seconds[i] ?? 0) * 1000);
    const end = Math.round((alignment.character_end_times_seconds[i] ?? 0) * 1000);
    if (!current) current = { text: ch, startMs: start, endMs: Math.max(start, end) };
    else {
      current.text += ch;
      current.endMs = Math.max(current.endMs, end);
    }
  });
  if (current) words.push(current);
  return words;
}

/** The output format asked for: MP3, 44.1 kHz, constant 128 kbit/s. */
const outputFormat = "mp3_44100_128";
const bitsPerMs = 128;

/**
 * How long the MP3 plays: constant 128 kbit/s, so bytes say it exactly (no decoder needed on
 * the server). Never shorter than the last word.
 */
export function mp3DurationMs(bytes: number, words: SpokenWordTiming[]): number {
  return Math.max(Math.round((bytes * 8) / bitsPerMs), words.at(-1)?.endMs ?? 0);
}

function errorFor(status: number, detail: string): TtsError {
  if (status === 401 || status === 403) {
    return new TtsError("TTS_AUTH", "The voice service refused our key.", status, false);
  }
  if (status === 404 || /voice_not_found/.test(detail)) {
    return new TtsError("TTS_VOICE", "The narrator's voice isn't available.", status, false);
  }
  if (status === 429 || /quota_exceeded/.test(detail)) {
    return new TtsError("TTS_RATE_LIMIT", "The voice service is busy.", status, true);
  }
  if (status === 400 || status === 422) {
    return new TtsError(
      "TTS_REJECTED",
      "The voice service couldn't read this text.",
      status,
      false,
    );
  }
  return new TtsError("TTS_FAILED", "The voice service didn't answer.", status, status >= 500);
}

export type ElevenLabsOptions = {
  apiKey: string;
  /** For tests. */
  fetch?: typeof fetch;
  baseUrl?: string;
};

export function createElevenLabsTts(options: ElevenLabsOptions): TtsProvider {
  const doFetch = options.fetch ?? fetch;
  const base = options.baseUrl ?? "https://api.elevenlabs.io";
  return {
    provider: "elevenlabs",
    async synthesize(request) {
      const url = `${base}/v1/text-to-speech/${encodeURIComponent(request.voiceId)}/with-timestamps?output_format=${outputFormat}`;
      let response: Response;
      try {
        response = await doFetch(url, {
          method: "POST",
          headers: { "xi-api-key": options.apiKey, "Content-Type": "application/json" },
          body: JSON.stringify({
            text: request.text,
            model_id: request.model,
            language_code: request.language,
            voice_settings: { stability: 0.5, similarity_boost: 0.75, speed: request.speed },
          }),
        });
      } catch {
        throw new TtsError("TTS_FAILED", "The voice service didn't answer.", null, true);
      }
      if (!response.ok) {
        throw errorFor(response.status, (await response.text().catch(() => "")).slice(0, 300));
      }
      const body = (await response.json().catch(() => null)) as {
        audio_base64?: unknown;
        alignment?: Alignment | null;
      } | null;
      if (!body || typeof body.audio_base64 !== "string" || !body.alignment) {
        throw new TtsError("TTS_FAILED", "The voice service sent audio we can't read.", 200, true);
      }
      const audio = Uint8Array.from(Buffer.from(body.audio_base64, "base64"));
      const words = wordsFromCharacters(body.alignment);
      return {
        audio,
        mime: "audio/mpeg",
        durationMs: mp3DurationMs(audio.length, words),
        words,
        characters: request.text.length,
        timingSource: "provider",
      };
    },
  };
}

// ---- Stub ----

/** Words a second the narrator speaks (the same rates as script estimates, F15). */
const stubRate = { en: 2.5, hi: 2.2 } as const;

/**
 * One silent MPEG-1 Layer III frame at 128 kbit/s, 44.1 kHz, no padding: a 4-byte header and
 * 413 zero bytes, which decode as 1,152 samples (about 26 ms) of silence.
 */
const frameBytes = 417;
const frameMs = (1152 / 44_100) * 1000;

/** Silent MP3 audio about `durationMs` long, in whole frames. */
export function silentMp3(durationMs: number): Uint8Array {
  const frames = Math.max(1, Math.ceil(durationMs / frameMs));
  const audio = new Uint8Array(frames * frameBytes);
  for (let i = 0; i < frames; i++) audio.set([0xff, 0xfb, 0x90, 0x64], i * frameBytes);
  return audio;
}

export type StubTtsOptions = {
  /** Fails a request (tests): return an error to throw it. */
  failWith?: (request: SpeechRequest) => TtsError | null;
};

export function createStubTts(options: StubTtsOptions = {}): TtsProvider {
  return {
    provider: "stub",
    async synthesize(request) {
      const failure = options.failWith?.(request);
      if (failure) throw failure;
      const each = 1000 / (stubRate[request.language] * request.speed);
      const words = request.text
        .split(/\s+/)
        .filter(Boolean)
        .map((text, i) => ({
          text,
          startMs: Math.round(i * each),
          endMs: Math.round((i + 1) * each - each * 0.15),
        }));
      const spoken = Math.round(words.length * each);
      return {
        audio: silentMp3(spoken),
        mime: "audio/mpeg",
        durationMs: spoken,
        words,
        characters: request.text.length,
        timingSource: "estimated",
      };
    },
  };
}
