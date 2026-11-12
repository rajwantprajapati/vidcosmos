"use client";

// "Start a new video". On desktop, the prompt box: it creates the project with the topic, type
// and format, then opens step 1. On phones, a card that opens the New video screen (the
// create steps are full screens there).
import { videoTypeLabels, type VideoType } from "@vidcosmos/spec/collections";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon, PromptComposer } from "@/components/ui";
import { apiFetch, ApiRequestError } from "@/lib/api-client";
import { LimitNotice, type VideoLimit } from "./limit-notice";

const typeByLabel = Object.fromEntries(
  Object.entries(videoTypeLabels).map(([type, label]) => [label, type]),
) as Record<string, VideoType>;

/** The prompt box; shared by the library and its empty state. */
export function NewVideoComposer({
  defaultFormat,
  placeholder = "A 30-second reel that…",
  value,
  onValueChange,
  id,
  limit,
}: {
  /** Set when the monthly allowance is used up: Generate is off. */
  limit?: VideoLimit;
  defaultFormat: string;
  placeholder?: string;
  value: string;
  onValueChange: (value: string) => void;
  id: string;
}) {
  const router = useRouter();
  const [type, setType] = useState<string>(videoTypeLabels.explainer);
  const [format, setFormat] = useState(defaultFormat);
  const [busy, setBusy] = useState(false);
  // An error belongs to the text it was about: any change (typing, a suggestion) clears it.
  const [failure, setFailure] = useState<{ message: string; text: string }>();
  const error = failure && failure.text === value ? failure.message : undefined;
  const setError = (message?: string) => setFailure(message ? { message, text: value } : undefined);

  async function generate() {
    // The button is off at the limit; this also stops a submit from anywhere else.
    if (limit) return;
    const topic = value.trim();
    if (topic.length < 3) {
      setError("Describe your video in a few words.");
      document.getElementById(id)?.focus();
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      const project = await apiFetch<{ id: string }>("/projects", {
        method: "POST",
        idempotent: true,
        body: { topic, videoType: typeByLabel[type] ?? "explainer", settings: { format } },
      });
      router.push(`/projects/${project.id}/idea`);
    } catch (failure) {
      setBusy(false);
      setError(
        failure instanceof ApiRequestError ? failure.message : "Something went wrong. Try again.",
      );
      document.getElementById(id)?.focus();
    }
  }

  return (
    <PromptComposer
      id={id}
      rows={2}
      placeholder={placeholder}
      value={value}
      onChange={(event) => onValueChange(event.target.value)}
      type={type}
      onTypeChange={setType}
      defaultFormat={defaultFormat}
      onFormatChange={setFormat}
      onGenerate={generate}
      loading={busy}
      error={error}
      generateDisabled={Boolean(limit)}
    />
  );
}

export function NewVideoSection({
  defaultFormat,
  limit,
}: {
  defaultFormat: string;
  limit?: VideoLimit;
}) {
  const [value, setValue] = useState("");
  return (
    <>
      <section aria-labelledby="start-h" className="hidden flex-col gap-3 md:flex">
        <h2 id="start-h" className="m-0 font-display text-[20px] leading-[30px] font-extrabold">
          Start a new video
        </h2>
        {limit ? <LimitNotice limit={limit} /> : null}
        <NewVideoComposer
          limit={limit}
          id="lib-prompt"
          defaultFormat={defaultFormat}
          value={value}
          onValueChange={setValue}
        />
      </section>
      {limit ? <LimitNotice limit={limit} className="md:hidden" /> : null}
      <Link
        href="/projects/new"
        aria-disabled={limit ? true : undefined}
        tabIndex={limit ? -1 : undefined}
        onClick={limit ? (event) => event.preventDefault() : undefined}
        className={`flex flex-col gap-2.5 rounded-[16px] border border-line bg-surface p-3.5 text-ink no-underline md:hidden ${limit ? "pointer-events-none opacity-45" : ""}`}
      >
        <span className="text-[13px] leading-4 font-semibold">Start a new video</span>
        <span className="flex items-center gap-2.5">
          <span className="flex min-h-11 flex-1 items-center rounded-[10px] bg-surface-sunken px-3 text-[15px] text-ink-muted">
            Describe your video…
          </span>
          <span className="inline-flex size-11 items-center justify-center rounded-[10px] bg-brand text-on-brand">
            <Icon name="sparkles" size={20} />
          </span>
        </span>
      </Link>
    </>
  );
}
