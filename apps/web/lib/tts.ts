// The narrator's voice for this server (SDD §8): ElevenLabs when the voice is live, the stub
// otherwise (silent audio with word timings, no cost). The stub refuses narration containing
// `stubFailPhrase`, so a scene that fails can be tried in development and end-to-end tests.
import "server-only";
import {
  createElevenLabsTts,
  createStubTts,
  TtsError,
  type TtsProvider,
} from "@vidcosmos/integrations";
import { env } from "@/env";
import { selectProvider } from "./providers";

/** Narration the stub voice won't record (development and tests only). */
export const stubFailPhrase = "Narration fails here";

// Kept on globalThis so hot reload in development reuses the client.
const cache = globalThis as typeof globalThis & { __vidcosmosTts?: TtsProvider };

export function getTts(): TtsProvider {
  cache.__vidcosmosTts ??= selectProvider(env, "tts", {
    stub: () =>
      createStubTts({
        failWith: (request) =>
          request.text.includes(stubFailPhrase)
            ? new TtsError("TTS_REJECTED", "The stub voice refuses this text.", 422, false)
            : null,
      }),
    // The env schema requires the key when the voice is live.
    live: (live) => createElevenLabsTts({ apiKey: live.ELEVENLABS_API_KEY ?? "" }),
  });
  return cache.__vidcosmosTts;
}
