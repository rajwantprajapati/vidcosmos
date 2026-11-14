// F12: the R2 key layout (DB §7) and the checks that keep keys inside their folders.
import { describe, expect, it } from "vitest";
import { attachmentHeader, urlLifetimes } from "./artifact-store.ts";
import {
  exportKey,
  exportPrefix,
  isValidKey,
  musicKey,
  narrationKey,
  StorageKeyError,
  thumbnailKey,
  workspacePrefix,
} from "./keys.ts";
import { assertValidPrefix } from "./prefix.ts";

const ws = "6730a1b2c3d4e5f6a7b8c9d0";
const other = "6730a1b2c3d4e5f6a7b8c9d1";
const hash = "a".repeat(64);

describe("key layout", () => {
  it("builds every key under the workspace prefix", () => {
    expect(workspacePrefix(ws)).toBe(`ws/${ws}/`);
    expect(narrationKey(ws, hash)).toBe(`ws/${ws}/narration/${hash}.mp3`);
    expect(exportKey(ws, other, "mp4")).toBe(`ws/${ws}/exports/${other}/video.mp4`);
    expect(exportKey(ws, other, "mp3")).toBe(`ws/${ws}/exports/${other}/audio.mp3`);
    expect(exportKey(ws, other, "cover")).toBe(`ws/${ws}/exports/${other}/cover.jpg`);
    expect(exportKey(ws, other, "srt")).toBe(`ws/${ws}/exports/${other}/captions.srt`);
    expect(exportPrefix(ws, other)).toBe(`ws/${ws}/exports/${other}/`);
    expect(thumbnailKey(ws, other)).toBe(`ws/${ws}/thumbs/${other}.jpg`);
    expect(musicKey("lofi-01")).toBe("music/lofi-01.mp3");
  });

  it("refuses parts that could leave their folder", () => {
    for (const build of [
      () => workspacePrefix("../x"),
      () => workspacePrefix(ws.toUpperCase()),
      () => narrationKey(ws, "abc"),
      () => narrationKey(ws, `${hash.slice(1)}/`),
      () => exportKey(ws, "../../etc", "mp4"),
      () => thumbnailKey(ws, ""),
      () => musicKey("../ws"),
      () => musicKey("A b"),
    ]) {
      expect(build).toThrow(StorageKeyError);
    }
  });

  it("accepts only keys and prefixes of the layout", () => {
    expect(isValidKey(narrationKey(ws, hash))).toBe(true);
    expect(isValidKey("dev/sample.png")).toBe(true);
    for (const key of [
      "",
      "other/x.mp3",
      `ws/${ws}/../${other}/x.mp3`,
      `ws/${ws}//x.mp3`,
      `ws/${ws}/./x.mp3`,
      "/ws/x",
      `ws/${ws}/x y.mp3`,
      `dev/${"a".repeat(600)}`,
    ]) {
      expect(isValidKey(key), key).toBe(false);
    }
    expect(assertValidPrefix(`ws/${ws}/`)).toBe(`ws/${ws}/`);
    expect(assertValidPrefix(exportPrefix(ws, other))).toBeTruthy();
    expect(() => assertValidPrefix("ws/")).toThrow(StorageKeyError);
    expect(() => assertValidPrefix("")).toThrow(StorageKeyError);
    expect(() => assertValidPrefix(`ws/${ws}/../`)).toThrow(StorageKeyError);
  });
});

describe("signed URL settings", () => {
  it("gives each reader its lifetime (SDD §12)", () => {
    expect(urlLifetimes).toEqual({
      playback: 3600,
      download: 900,
      renderInput: 7200,
      renderOutput: 1800,
      instagram: 21600,
    });
  });

  it("builds a download header with an ASCII fallback and the UTF-8 name", () => {
    expect(attachmentHeader("UPI kaise kaam karta hai.mp4")).toBe(
      `attachment; filename="UPI kaise kaam karta hai.mp4"; filename*=UTF-8''UPI%20kaise%20kaam%20karta%20hai.mp4`,
    );
    expect(attachmentHeader('यूपीआई "1".mp4')).toBe(
      `attachment; filename="______ _1_.mp4"; filename*=UTF-8''${encodeURIComponent('यूपीआई "1".mp4')}`,
    );
    expect(attachmentHeader("Asha's (1).mp4")).toContain("filename*=UTF-8''Asha%27s%20%281%29.mp4");
  });
});
