// The live store: Cloudflare R2 through its S3-compatible API (SDD §12). One private bucket per
// environment; reads and uploads from outside the server use presigned URLs. The access key
// stays on the server.
import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { type ArtifactStore, attachmentHeader } from "./artifact-store.ts";
import { assertValidKey } from "./keys.ts";
import { assertValidPrefix } from "./prefix.ts";

export type R2Options = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  /** For tests: a client pointed somewhere else. */
  client?: S3Client;
};

const notFound = (error: unknown) => {
  const e = error as { name?: string; $metadata?: { httpStatusCode?: number } };
  return e.name === "NoSuchKey" || e.name === "NotFound" || e.$metadata?.httpStatusCode === 404;
};

export function createR2Client(options: Omit<R2Options, "bucket" | "client">): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: `https://${options.accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: options.accessKeyId, secretAccessKey: options.secretAccessKey },
    // Checksums only where the API requires them: a checksum signed into a presigned PUT would
    // have to be sent by the uploader too.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
}

export function createR2ArtifactStore(options: R2Options): ArtifactStore {
  const s3 = options.client ?? createR2Client(options);
  const Bucket = options.bucket;

  return {
    async put(key, body, { contentType }) {
      await s3.send(
        new PutObjectCommand({
          Bucket,
          Key: assertValidKey(key),
          Body: body,
          ContentType: contentType,
        }),
      );
    },

    async get(key) {
      try {
        const out = await s3.send(new GetObjectCommand({ Bucket, Key: assertValidKey(key) }));
        const body = await out.Body!.transformToByteArray();
        return {
          body,
          contentType: out.ContentType ?? "application/octet-stream",
          bytes: body.byteLength,
        };
      } catch (error) {
        if (notFound(error)) return null;
        throw error;
      }
    },

    async head(key) {
      try {
        const out = await s3.send(new HeadObjectCommand({ Bucket, Key: assertValidKey(key) }));
        return {
          contentType: out.ContentType ?? "application/octet-stream",
          bytes: out.ContentLength ?? 0,
        };
      } catch (error) {
        if (notFound(error)) return null;
        throw error;
      }
    },

    async delete(key) {
      await s3.send(new DeleteObjectCommand({ Bucket, Key: assertValidKey(key) }));
    },

    async deletePrefix(prefix) {
      const Prefix = assertValidPrefix(prefix);
      let deleted = 0;
      let token: string | undefined;
      do {
        const page = await s3.send(
          new ListObjectsV2Command({ Bucket, Prefix, ContinuationToken: token, MaxKeys: 1000 }),
        );
        const keys = (page.Contents ?? []).flatMap((o) => (o.Key ? [{ Key: o.Key }] : []));
        if (keys.length > 0) {
          await s3.send(
            new DeleteObjectsCommand({ Bucket, Delete: { Objects: keys, Quiet: true } }),
          );
          deleted += keys.length;
        }
        token = page.IsTruncated ? page.NextContinuationToken : undefined;
      } while (token);
      return deleted;
    },

    async signGet(key, { expiresIn, downloadAs }) {
      const command = new GetObjectCommand({
        Bucket,
        Key: assertValidKey(key),
        ...(downloadAs ? { ResponseContentDisposition: attachmentHeader(downloadAs) } : {}),
      });
      const url = await getSignedUrl(s3, command, { expiresIn });
      return { url, expiresAt: new Date(Date.now() + expiresIn * 1000) };
    },

    async signPut(key, { expiresIn, contentType }) {
      const command = new PutObjectCommand({
        Bucket,
        Key: assertValidKey(key),
        ContentType: contentType,
      });
      const url = await getSignedUrl(s3, command, {
        expiresIn,
        signableHeaders: new Set(["content-type"]),
      });
      return { url, expiresAt: new Date(Date.now() + expiresIn * 1000) };
    },
  };
}
