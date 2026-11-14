// Development only (F12): stores two sample files and shows them through signed URLs, the way
// the preview player and downloads will. With `PROVIDERS=stub` the files are on disk and the
// app serves them; with live storage they go to the R2 bucket. 404 in production.
import { urlLifetimes } from "@vidcosmos/integrations";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { env } from "@/env";
import { getStorage } from "@/lib/storage";
import { samplePng, sampleWav } from "./samples";

export const metadata: Metadata = { title: "Storage · Vidcosmos" };
export const dynamic = "force-dynamic";

const imageKey = "dev/sample-image.png";
const audioKey = "dev/sample-tone.wav";

export default async function DevStoragePage() {
  if (process.env.NODE_ENV === "production") notFound();
  const storage = getStorage();
  await storage.put(imageKey, samplePng(), { contentType: "image/png" });
  await storage.put(audioKey, sampleWav(), { contentType: "audio/wav" });
  const [image, audio, download] = await Promise.all([
    storage.signGet(imageKey, { expiresIn: urlLifetimes.playback }),
    storage.signGet(audioKey, { expiresIn: urlLifetimes.playback }),
    storage.signGet(imageKey, { expiresIn: urlLifetimes.download, downloadAs: "Sample image.png" }),
  ]);
  const where =
    env.providers.storage === "stub"
      ? "Files on this computer (storage stub), served by the app"
      : `Cloudflare R2, bucket ${env.R2_BUCKET}`;

  return (
    <main className="mx-auto flex max-w-reading flex-col gap-6 px-4 py-10 md:px-10">
      <header className="flex flex-col gap-2">
        <h1 className="h1 m-0">Storage</h1>
        <p className="body m-0 text-ink-secondary">
          Two sample files, stored and read back through signed links. {where}.
        </p>
      </header>
      <section
        aria-labelledby="image-h"
        className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-5"
      >
        <h2 id="image-h" className="h3 m-0">
          Image
        </h2>
        {/* A signed URL from storage: next/image would need every host configured. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image.url} alt="Sample image: three coloured stripes" width={96} height={64} />
        <a className="body text-brand-text underline" href={download.url}>
          Download the sample image
        </a>
        <p className="body-sm m-0 text-ink-muted">
          Viewing link valid for an hour, download link for 15 minutes.
        </p>
      </section>
      <section
        aria-labelledby="audio-h"
        className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-5"
      >
        <h2 id="audio-h" className="h3 m-0">
          Audio
        </h2>
        <audio controls preload="metadata" src={audio.url} aria-label="Sample tone, one second">
          <track kind="captions" />
        </audio>
      </section>
    </main>
  );
}
