"use client";

// The editor's quick settings (Editor design, API §5): the video theme, caption style, narrator
// and format. Theme, captions and format change only the look, so the preview updates at once
// and no narration is recorded; a new narrator needs every scene recorded again.
import type { VideoSpec } from "@vidcosmos/spec/video";
import { cn, SegmentedControl } from "@/components/ui";

export type QuickSettingsValue = {
  palette: VideoSpec["theme"]["palette"];
  captionStyle: VideoSpec["theme"]["captionStyle"];
  voiceGender: VideoSpec["voice"]["gender"];
  format: VideoSpec["format"];
};

const themes: { value: QuickSettingsValue["palette"]; name: string }[] = [
  { value: "midnight", name: "Midnight" },
  { value: "paper", name: "Paper" },
  { value: "ocean", name: "Ocean" },
  { value: "sunset", name: "Sunset" },
];

const heading = "text-[12px] font-semibold tracking-[0.08em] text-ink-muted uppercase";

export function QuickSettings({
  value,
  onChange,
  disabled = false,
  className,
}: {
  value: QuickSettingsValue;
  onChange: (change: Partial<QuickSettingsValue>) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex w-full flex-wrap gap-5 rounded-[16px] border border-line bg-surface p-4",
        disabled && "pointer-events-none opacity-60",
        className,
      )}
    >
      <div className="flex flex-col gap-2">
        <span className={heading} id="qs-theme">
          Video theme
        </span>
        <div role="radiogroup" aria-labelledby="qs-theme" className="flex gap-2">
          {themes.map((theme) => {
            const checked = value.palette === theme.value;
            return (
              <button
                key={theme.value}
                type="button"
                role="radio"
                aria-checked={checked}
                aria-label={theme.name}
                disabled={disabled}
                onClick={() => onChange({ palette: theme.value })}
                style={{ background: `var(--video-${theme.value}-bg)` }}
                className={cn(
                  "inline-flex size-9 cursor-pointer items-end justify-end rounded-[10px] p-1 focus-visible:shadow-[0_0_0_2px_var(--bg),0_0_0_4px_var(--focus-ring)] focus-visible:outline-none",
                  checked ? "border-2 border-brand" : "border border-line-strong",
                )}
              >
                <span
                  aria-hidden="true"
                  className="size-2.5 rounded-[3px]"
                  style={{ background: `var(--video-${theme.value}-highlight)` }}
                />
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <span className={heading}>Captions</span>
        <SegmentedControl
          label="Captions"
          size="sm"
          value={value.captionStyle}
          onChange={(captionStyle) =>
            onChange({ captionStyle: captionStyle as QuickSettingsValue["captionStyle"] })
          }
          options={[
            { value: "highlight", label: "Highlight" },
            { value: "classic", label: "Classic" },
            { value: "none", label: "Off" },
          ]}
        />
      </div>
      <div className="flex flex-col gap-2">
        <span className={heading}>Narrator</span>
        <SegmentedControl
          label="Narrator"
          size="sm"
          value={value.voiceGender}
          onChange={(voiceGender) =>
            onChange({ voiceGender: voiceGender as QuickSettingsValue["voiceGender"] })
          }
          options={[
            { value: "female", label: "Female" },
            { value: "male", label: "Male" },
          ]}
        />
      </div>
      <div className="flex flex-col gap-2">
        <span className={heading}>Format</span>
        <SegmentedControl
          label="Format"
          size="sm"
          value={value.format}
          onChange={(format) => onChange({ format: format as QuickSettingsValue["format"] })}
          options={[
            { value: "9:16", label: "9:16" },
            { value: "16:9", label: "16:9" },
            { value: "1:1", label: "1:1" },
          ]}
        />
      </div>
    </div>
  );
}
