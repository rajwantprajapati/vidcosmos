// The R2 key layout (DB §7 "R2 layout", which wins over SDD §12). Everything a workspace owns
// sits under `ws/{workspaceId}/`, so deleting an account is one prefix delete; licensed music
// is shared by everyone. Every builder checks its parts, so a key can never climb out of its
// folder or into another workspace's.
//
//   ws/{workspaceId}/narration/{hash}.mp3
//   ws/{workspaceId}/exports/{exportId}/video.mp4  audio.mp3  cover.jpg  captions.srt
//   ws/{workspaceId}/thumbs/{projectId}.jpg
//   music/{trackId}.mp3

const objectIdPattern = /^[0-9a-f]{24}$/;
const sha256Pattern = /^[0-9a-f]{64}$/;
const slugPattern = /^[a-z0-9][a-z0-9_-]{0,63}$/;

export class StorageKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageKeyError";
  }
}

function check(value: string, pattern: RegExp, what: string): string {
  if (!pattern.test(value)) throw new StorageKeyError(`${what} isn't valid for a storage key.`);
  return value;
}

const id = (value: string, what: string) => check(value, objectIdPattern, what);

/** Everything one workspace owns. */
export const workspacePrefix = (workspaceId: string) => `ws/${id(workspaceId, "workspaceId")}/`;

/** One scene's narration, shared by content hash (`narrationHash`). */
export const narrationKey = (workspaceId: string, hash: string) =>
  `${workspacePrefix(workspaceId)}narration/${check(hash, sha256Pattern, "hash")}.mp3`;

export const exportFiles = {
  mp4: "video.mp4",
  mp3: "audio.mp3",
  cover: "cover.jpg",
  srt: "captions.srt",
} as const;
export type ExportFile = keyof typeof exportFiles;

/** One file of an export. */
export const exportKey = (workspaceId: string, exportId: string, file: ExportFile) =>
  `${exportPrefix(workspaceId, exportId)}${exportFiles[file]}`;

/** All files of one export. */
export const exportPrefix = (workspaceId: string, exportId: string) =>
  `${workspacePrefix(workspaceId)}exports/${id(exportId, "exportId")}/`;

/** The library thumbnail of a project. */
export const thumbnailKey = (workspaceId: string, projectId: string) =>
  `${workspacePrefix(workspaceId)}thumbs/${id(projectId, "projectId")}.jpg`;

/** A licensed background track, shared by all users (SDD §12). */
export const musicKey = (trackId: string) => `music/${check(trackId, slugPattern, "trackId")}.mp3`;

/**
 * Whether a key is one this layout builds (checked again by stores before touching a file).
 * Allows the paths above and `dev/` files for the development storage page.
 */
export function isValidKey(key: string): boolean {
  return (
    key.length <= 512 &&
    /^(ws\/[0-9a-f]{24}|music|dev)\/[A-Za-z0-9._/-]+$/.test(key) &&
    !key.split("/").some((part) => part === "" || part === "." || part === "..")
  );
}

export function assertValidKey(key: string): string {
  if (!isValidKey(key)) throw new StorageKeyError("That isn't a valid storage key.");
  return key;
}
