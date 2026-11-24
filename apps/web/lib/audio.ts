// Playback links for narration (SDD §4 "Preview player", API §7 "Audio URLs"): each asset the
// project plays, signed for an hour, by asset id. The Player maps each scene's
// `timing.narrationAssetId` to its link, and asks again before they expire.
import "server-only";
import { projectNarration } from "@vidcosmos/db";
import { urlLifetimes } from "@vidcosmos/integrations";
import type { Project } from "@vidcosmos/spec/collections";
import { getDb } from "./db";
import { getStorage } from "./storage";

export type AudioLinks = Record<string, { url: string; expiresAt: Date }>;

/** Signed links for the narration the project's draft plays, or for `ids` it may play. */
export async function projectAudio(project: Project, ids?: string[]): Promise<AudioLinks> {
  const assets = await projectNarration(getDb(), project, ids);
  const storage = getStorage();
  const signed = await Promise.all(
    assets.map(
      async ({ id, key }) =>
        [id, await storage.signGet(key, { expiresIn: urlLifetimes.playback })] as const,
    ),
  );
  return Object.fromEntries(signed);
}
