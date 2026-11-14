// Where generated files live (SDD §12): one private bucket, read and written only through
// short-lived signed URLs. `createR2ArtifactStore` is the live store; `createLocalArtifactStore`
// keeps files on disk for `PROVIDERS=stub` and serves them through the app.

export type SignedUrl = { url: string; expiresAt: Date };

export type StoredObject = { body: Uint8Array; contentType: string; bytes: number };

export type ObjectInfo = { contentType: string; bytes: number };

export type SignGetOptions = {
  /** Seconds the link works; see `urlLifetimes`. */
  expiresIn: number;
  /** Download as an attachment with this file name (`Content-Disposition`). */
  downloadAs?: string;
};

export type SignPutOptions = {
  expiresIn: number;
  /** The uploader must send this Content-Type. */
  contentType: string;
};

export interface ArtifactStore {
  put(key: string, body: Uint8Array, options: { contentType: string }): Promise<void>;
  /** Null when there's no such file. */
  get(key: string): Promise<StoredObject | null>;
  head(key: string): Promise<ObjectInfo | null>;
  /** Deleting a missing file is fine. */
  delete(key: string): Promise<void>;
  /** Deletes every file under a prefix (an export, a workspace). Returns how many. */
  deletePrefix(prefix: string): Promise<number>;
  signGet(key: string, options: SignGetOptions): Promise<SignedUrl>;
  signPut(key: string, options: SignPutOptions): Promise<SignedUrl>;
}

const minutes = 60;
const hours = 60 * minutes;

/** How long each reader's signed URL works (SDD §12; playback 1 hour, decision log 13 Nov). */
export const urlLifetimes = {
  /** Preview player: narration and music, refetched with the project. */
  playback: 1 * hours,
  /** User downloads (MP4, MP3, cover, SRT), as attachments. */
  download: 15 * minutes,
  /** Renderer in Vercel Sandbox reading its inputs. */
  renderInput: 2 * hours,
  /** Renderer uploading its outputs (PUT). */
  renderOutput: 30 * minutes,
  /** Instagram fetching the video and cover. */
  instagram: 6 * hours,
} as const;

/** `Content-Disposition` for a download, with a safe ASCII fallback and the UTF-8 name. */
export function attachmentHeader(fileName: string): string {
  const ascii = fileName.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  // RFC 5987: also escape the characters encodeURIComponent leaves alone that aren't allowed.
  const utf8 = encodeURIComponent(fileName).replace(
    /['()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `attachment; filename="${ascii}"; filename*=UTF-8''${utf8}`;
}
