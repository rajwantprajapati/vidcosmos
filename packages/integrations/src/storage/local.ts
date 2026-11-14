// The stub store for `PROVIDERS=stub`: files on disk, served by the app itself. Signed URLs work
// like R2's: they point at the app's storage route, carry an expiry and an HMAC signature over
// the method, key, expiry and options, and are refused (403) once tampered with or expired.
// `handleLocalStorageRequest` is that route's whole logic: GET and HEAD with Range (so audio
// can seek), and PUT with the signed Content-Type.
import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { type ArtifactStore, attachmentHeader } from "./artifact-store.ts";
import { assertValidKey, isValidKey } from "./keys.ts";
import { assertValidPrefix } from "./prefix.ts";

export type LocalStoreOptions = {
  /** The folder files are kept in. */
  root: string;
  /** Where the app's storage route is, e.g. http://localhost:3000/api/dev/storage. */
  routeUrl: string;
  /** Signs URLs; at least 32 characters. */
  secret: string;
  now?: () => Date;
};

/** The biggest upload the stub accepts (an export is 15-25 MB). */
export const localMaxUploadBytes = 200 * 1024 * 1024;

type Meta = { contentType: string };

type Signed = {
  method: "GET" | "PUT";
  key: string;
  expires: number;
  downloadAs?: string;
  contentType?: string;
};

export type LocalArtifactStore = ArtifactStore & {
  /** Checks a signed request's parameters. */
  verify(params: Signed & { signature: string }): boolean;
};

export function createLocalArtifactStore(options: LocalStoreOptions): LocalArtifactStore {
  if (options.secret.length < 32)
    throw new Error("The storage stub needs a secret of 32+ characters.");
  const now = options.now ?? (() => new Date());
  const filePath = (key: string) => join(options.root, "files", assertValidKey(key));
  const metaPath = (key: string) => join(options.root, "meta", `${assertValidKey(key)}.json`);

  const sign = (s: Signed) =>
    createHmac("sha256", options.secret)
      .update([s.method, s.key, s.expires, s.downloadAs ?? "", s.contentType ?? ""].join("\n"))
      .digest("base64url");

  const signedUrl = (s: Signed) => {
    const params = new URLSearchParams({ method: s.method, expires: String(s.expires) });
    if (s.downloadAs) params.set("download", s.downloadAs);
    if (s.contentType) params.set("type", s.contentType);
    params.set("sig", sign(s));
    const path = s.key.split("/").map(encodeURIComponent).join("/");
    return { url: `${options.routeUrl}/${path}?${params}`, expiresAt: new Date(s.expires * 1000) };
  };

  const expiry = (expiresIn: number) => Math.floor(now().getTime() / 1000) + expiresIn;

  async function readMeta(key: string): Promise<Meta | null> {
    try {
      return JSON.parse(await readFile(metaPath(key), "utf8")) as Meta;
    } catch {
      return null;
    }
  }

  async function listFiles(dir: string): Promise<string[]> {
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
    const nested = await Promise.all(
      entries.map((entry) =>
        entry.isDirectory() ? listFiles(join(dir, entry.name)) : [join(dir, entry.name)],
      ),
    );
    return nested.flat();
  }

  return {
    async put(key, body, { contentType }) {
      await mkdir(dirname(filePath(key)), { recursive: true });
      await mkdir(dirname(metaPath(key)), { recursive: true });
      await writeFile(filePath(key), body);
      await writeFile(metaPath(key), JSON.stringify({ contentType } satisfies Meta));
    },

    async get(key) {
      const meta = await readMeta(key);
      if (!meta) return null;
      const body = new Uint8Array(await readFile(filePath(key)));
      return { body, contentType: meta.contentType, bytes: body.byteLength };
    },

    async head(key) {
      const meta = await readMeta(key);
      if (!meta) return null;
      return { contentType: meta.contentType, bytes: (await stat(filePath(key))).size };
    },

    async delete(key) {
      await rm(filePath(key), { force: true });
      await rm(metaPath(key), { force: true });
    },

    async deletePrefix(prefix) {
      const dir = join(options.root, "files", assertValidPrefix(prefix));
      const count = (await listFiles(dir)).length;
      await rm(dir, { recursive: true, force: true });
      await rm(join(options.root, "meta", prefix), { recursive: true, force: true });
      return count;
    },

    async signGet(key, { expiresIn, downloadAs }) {
      return signedUrl({
        method: "GET",
        key: assertValidKey(key),
        expires: expiry(expiresIn),
        downloadAs,
      });
    },

    async signPut(key, { expiresIn, contentType }) {
      return signedUrl({
        method: "PUT",
        key: assertValidKey(key),
        expires: expiry(expiresIn),
        contentType,
      });
    },

    verify({ signature, ...signed }) {
      if (!isValidKey(signed.key)) return false;
      if (signed.expires * 1000 < now().getTime()) return false;
      const expected = Buffer.from(sign(signed));
      const given = Buffer.from(signature);
      return expected.length === given.length && timingSafeEqual(expected, given);
    },
  };
}

/**
 * On every stub response: files come from the app's own origin, so the browser must not guess
 * another type (nosniff) and a file opened directly can't run script or reach the app (sandbox).
 */
const safetyHeaders = {
  "X-Content-Type-Options": "nosniff",
  "Content-Security-Policy": "sandbox",
} as const;

type Body = ConstructorParameters<typeof Response>[0];
type HeaderList = ConstructorParameters<typeof Headers>[0];

const respond = (body: Body, status: number, headers: HeaderList = {}) => {
  const all = new Headers(headers);
  for (const [name, value] of Object.entries(safetyHeaders)) all.set(name, value);
  return new Response(body, { status, headers: all });
};

const denied = () => respond("This link is invalid or has expired.", 403);

/** Parses a single `bytes=` range; null means "the whole file", "invalid" means 416. */
function parseRange(header: string | null, size: number): [number, number] | null | "invalid" {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match || (match[1] === "" && match[2] === "")) return "invalid";
  let start: number;
  let end: number;
  if (match[1] === "") {
    const suffix = Number(match[2]);
    if (suffix === 0) return "invalid";
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] === "" ? size - 1 : Math.min(Number(match[2]), size - 1);
  }
  if (start >= size || start > end) return "invalid";
  return [start, end];
}

/** The storage route: `key` is the path after the route, already decoded. */
export async function handleLocalStorageRequest(
  store: LocalArtifactStore,
  request: Request,
  key: string,
): Promise<Response> {
  const url = new URL(request.url);
  const method = request.method === "HEAD" ? "GET" : request.method;
  if (method !== "GET" && method !== "PUT") return respond(null, 405);
  const signed = {
    method: method as "GET" | "PUT",
    key,
    expires: Number(url.searchParams.get("expires")),
    downloadAs: url.searchParams.get("download") ?? undefined,
    contentType: url.searchParams.get("type") ?? undefined,
    signature: url.searchParams.get("sig") ?? "",
  };
  if (url.searchParams.get("method") !== method || !Number.isFinite(signed.expires))
    return denied();
  if (!store.verify(signed)) return denied();

  if (method === "PUT") {
    if (request.headers.get("content-type") !== signed.contentType) return denied();
    // Refused before reading when the declared size is too big; the real size is checked too.
    if (Number(request.headers.get("content-length")) > localMaxUploadBytes) {
      return respond(null, 413);
    }
    const body = new Uint8Array(await request.arrayBuffer());
    if (body.byteLength > localMaxUploadBytes) return respond(null, 413);
    await store.put(key, body, { contentType: signed.contentType ?? "application/octet-stream" });
    return respond(null, 200);
  }

  const object = await store.get(key);
  if (!object) return respond("Not found.", 404);
  const headers = new Headers({
    "Content-Type": object.contentType,
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, no-store",
  });
  if (signed.downloadAs) headers.set("Content-Disposition", attachmentHeader(signed.downloadAs));

  const range = parseRange(request.headers.get("range"), object.bytes);
  if (range === "invalid") {
    headers.set("Content-Range", `bytes */${object.bytes}`);
    return respond(null, 416, headers);
  }
  const [start, end] = range ?? [0, object.bytes - 1];
  // A copy (slice) rather than a view: a Response body needs its own ArrayBuffer.
  const body = object.body.slice(start, end + 1);
  headers.set("Content-Length", String(body.byteLength));
  if (range) headers.set("Content-Range", `bytes ${start}-${end}/${object.bytes}`);
  // Next.js streams route-handler responses and drops Content-Length on the way out (in dev
  // and with `next start`); Content-Range still carries the full size for seeking. R2 sends both.
  return respond(request.method === "HEAD" ? null : body, range ? 206 : 200, headers);
}
