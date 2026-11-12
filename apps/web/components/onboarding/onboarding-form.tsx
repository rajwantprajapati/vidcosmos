"use client";

// The onboarding screen: what you make, topic area, narration language, default narrator.
// Saves through PUT /api/v1/me/onboarding; "Skip for now" through POST …/skip.
import { GraduationCap, type LucideIcon, ShoppingBag, Sparkle, Video } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, type KeyboardEvent, useRef, useState } from "react";
import { FormMessage } from "@/components/auth/auth-card";
import { Button, cn, Logo, SegmentedControl, TextField } from "@/components/ui";

type Persona = "creator" | "educator" | "brand" | "other";
type Language = "en" | "hi";
type VoiceGender = "female" | "male";

const personas: { value: Persona; title: string; sub: string; icon: LucideIcon }[] = [
  { value: "creator", title: "Creator", sub: "Reels and Shorts for my followers", icon: Video },
  {
    value: "educator",
    title: "Educator",
    sub: "Lessons and explainers for students",
    icon: GraduationCap,
  },
  {
    value: "brand",
    title: "Brand or business",
    sub: "Product ads, launches and promos",
    icon: ShoppingBag,
  },
  { value: "other", title: "Something else", sub: "Stories, quotes, travel, music", icon: Sparkle },
];

const sectionTitle = "m-0 font-display text-[20px] leading-[30px] font-bold";

async function send(path: string, method: "PUT" | "POST", body?: object) {
  const response = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (response.ok) return null;
  const payload = (await response.json().catch(() => null)) as {
    error?: { message?: string };
  } | null;
  return payload?.error?.message ?? "Something went wrong. Try again in a moment.";
}

export function OnboardingForm({
  next,
  firstName,
  defaults,
}: {
  /** Where to go after saving or skipping (already checked to be an app path). */
  next: string;
  firstName: string;
  defaults: { language: Language; voiceGender: VoiceGender };
}) {
  const router = useRouter();
  const [persona, setPersona] = useState<Persona>("creator");
  const [language, setLanguage] = useState<Language>(defaults.language);
  const [voiceGender, setVoiceGender] = useState<VoiceGender>(defaults.voiceGender);
  const [busy, setBusy] = useState<"save" | "skip" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cards = useRef<(HTMLButtonElement | null)[]>([]);

  async function finish(action: "save" | "skip", request: () => Promise<string | null>) {
    setBusy(action);
    setError(null);
    const failed = await request();
    if (failed) {
      setBusy(null);
      setError(failed);
      return;
    }
    router.replace(next);
    router.refresh();
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const topicArea = String(new FormData(event.currentTarget).get("topicArea") ?? "").trim();
    void finish("save", () =>
      send("/api/v1/me/onboarding", "PUT", {
        persona,
        ...(topicArea ? { topicArea } : {}),
        language,
        voiceGender,
      }),
    );
  }

  /** Arrow keys move the choice, as in any radio group. */
  function onCardKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const target = (index + step + personas.length) % personas.length;
    setPersona(personas[target]!.value);
    cards.current[target]?.focus();
  }

  return (
    <div className="flex min-h-dvh flex-col bg-bg font-sans text-ink">
      <header className="box-border flex items-center justify-between px-10 py-5">
        <Logo size={28} />
        <span className="text-[14px] leading-5 text-ink-muted tabular-nums">
          Step 1 of 1 · about a minute
        </span>
      </header>
      <main className="box-border flex flex-1 justify-center pt-6 pr-[max(16px,env(safe-area-inset-right,0px))] pb-16 pl-[max(16px,env(safe-area-inset-left,0px))]">
        <form noValidate onSubmit={submit} className="flex w-full max-w-[720px] flex-col gap-9">
          <div className="flex flex-col gap-2.5">
            <h1 className="m-0 font-display text-[40px] leading-[46px] font-extrabold tracking-[-0.03em]">
              Hi {firstName}, let’s set up your studio
            </h1>
            <p className="m-0 text-[17px] leading-[27px] text-ink-secondary">
              Three quick answers so your first video starts with the right voice and style. You can
              change all of this later in Settings.
            </p>
          </div>

          <fieldset className="m-0 flex flex-col gap-3.5 border-0 p-0">
            <legend className={cn(sectionTitle, "mb-3.5 p-0")}>What will you make most?</legend>
            <div
              role="radiogroup"
              aria-label="What will you make most?"
              className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3"
            >
              {personas.map((option, index) => {
                const checked = option.value === persona;
                const Glyph = option.icon;
                return (
                  <button
                    key={option.value}
                    ref={(node) => {
                      cards.current[index] = node;
                    }}
                    type="button"
                    role="radio"
                    aria-checked={checked}
                    tabIndex={checked ? 0 : -1}
                    onClick={() => setPersona(option.value)}
                    onKeyDown={(event) => onCardKey(event, index)}
                    className={cn(
                      "flex min-h-[132px] cursor-pointer flex-col gap-2.5 rounded-[16px] p-[18px] text-left text-ink transition-[border-color,background-color] duration-[120ms]",
                      checked
                        ? "border-2 border-brand-text bg-brand-soft"
                        : "border border-line bg-surface hover:border-line-strong",
                    )}
                  >
                    <span
                      className={cn(
                        "inline-flex size-9 items-center justify-center rounded-[10px]",
                        checked ? "bg-brand text-on-brand" : "bg-surface-sunken text-ink-secondary",
                      )}
                    >
                      <Glyph aria-hidden="true" size={20} strokeWidth={1.75} />
                    </span>
                    <span className="text-[16px] leading-6 font-bold">{option.title}</span>
                    <span className="text-[13px] leading-[19px] text-ink-muted">{option.sub}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="flex flex-col gap-3.5">
            <h2 className={sectionTitle}>What are your videos usually about?</h2>
            <TextField
              id="ob-topics"
              name="topicArea"
              label="Topic area (optional)"
              placeholder="Science for school students, personal finance, handmade candles…"
              helper="We use this to suggest ideas and examples."
              maxLength={80}
            />
          </div>

          <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-6">
            <div className="flex flex-col gap-3">
              <h2 className={sectionTitle}>Narration language</h2>
              <SegmentedControl
                label="Narration language"
                options={[
                  { value: "en", label: "English" },
                  { value: "hi", label: "हिंदी", lang: "hi" },
                ]}
                value={language}
                onChange={(value) => setLanguage(value as Language)}
              />
              <span className="text-[13px] leading-5 text-ink-muted">
                You can pick per video too.
              </span>
            </div>
            <div className="flex flex-col gap-3">
              <h2 className={sectionTitle}>Default narrator</h2>
              <SegmentedControl
                label="Default narrator"
                options={[
                  { value: "female", label: "Female" },
                  { value: "male", label: "Male" },
                ]}
                value={voiceGender}
                onChange={(value) => setVoiceGender(value as VoiceGender)}
              />
              <span className="text-[13px] leading-5 text-ink-muted">Both are Indian voices.</span>
            </div>
          </div>

          {error ? <FormMessage tone="danger">{error}</FormMessage> : null}

          <div className="flex flex-wrap items-center gap-4 border-t border-line pt-2">
            <Button
              type="submit"
              size="lg"
              iconEnd="arrow-right"
              loading={busy === "save"}
              disabled={busy !== null}
            >
              {busy === "save" ? "Saving…" : "Start making videos"}
            </Button>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void finish("skip", () => send("/api/v1/me/onboarding/skip", "POST"))}
              className="mt-4 cursor-pointer rounded-sm border-0 bg-transparent p-0 text-[15px] leading-6 font-semibold text-brand-text underline hover:text-ink disabled:cursor-not-allowed disabled:opacity-45"
            >
              Skip for now
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
