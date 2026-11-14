// The file store for this server (SDD §12): Cloudflare R2 when storage is live, files on disk
// (`apps/web/.storage`, git-ignored) served by /api/dev/storage when it's the stub.
import "server-only";
import { createHmac } from "node:crypto";
import { join } from "node:path";
import {
  type ArtifactStore,
  createLocalArtifactStore,
  createR2ArtifactStore,
  type LocalArtifactStore,
} from "@vidcosmos/integrations";
import { env } from "@/env";
import { selectProvider } from "./providers";

/** Where the stub's signed URLs point. */
export const localStorageRoute = "/api/dev/storage";

// Kept on globalThis so hot reload in development reuses one store.
const cache = globalThis as typeof globalThis & { __vidcosmosStorage?: ArtifactStore };

function createStore(): ArtifactStore {
  return selectProvider(env, "storage", {
    stub: () =>
      createLocalArtifactStore({
        root: join(process.cwd(), ".storage"),
        routeUrl: `${env.BETTER_AUTH_URL}${localStorageRoute}`,
        // Its own key, derived from the auth secret, so stub links survive a restart.
        secret: createHmac("sha256", env.BETTER_AUTH_SECRET).update("storage-stub").digest("hex"),
      }),
    // The env schema requires all three when storage is live.
    live: (live) =>
      createR2ArtifactStore({
        accountId: live.R2_ACCOUNT_ID ?? "",
        accessKeyId: live.R2_ACCESS_KEY_ID ?? "",
        secretAccessKey: live.R2_SECRET_ACCESS_KEY ?? "",
        bucket: live.R2_BUCKET,
      }),
  });
}

export function getStorage(): ArtifactStore {
  cache.__vidcosmosStorage ??= createStore();
  return cache.__vidcosmosStorage;
}

/** The stub store, when storage is the stub; null when it's R2. */
export function getLocalStorage(): LocalArtifactStore | null {
  return env.providers.storage === "stub" ? (getStorage() as LocalArtifactStore) : null;
}
