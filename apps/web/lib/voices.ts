// The ElevenLabs voice for each narrator (PRD FR-5.2): a female and a male Indian voice in V1,
// set in `.env`. A new storyboard and a narrator change put the id in the draft's voice.
import "server-only";
import { env } from "@/env";

export const voiceIds = (): Record<"female" | "male", string> => ({
  female: env.ELEVENLABS_VOICE_ID_FEMALE,
  male: env.ELEVENLABS_VOICE_ID_MALE,
});
