"use client";

// Where every video starts: the prompt, the video type, the format and the generate button.
import { useState, type ChangeEventHandler } from "react";
import { Button } from "./button";
import { Chip } from "./chip";
import { cn } from "./cn";
import { SegmentedControl, type SegmentedOption } from "./segmented-control";
import { TextField } from "./text-field";

export const defaultVideoTypes = [
  "Explainer",
  "Product ad",
  "Story",
  "Travel",
  "Quote",
  "Music visual",
];
export const defaultFormats: SegmentedOption[] = [
  { value: "9:16", label: "9:16" },
  { value: "16:9", label: "16:9" },
  { value: "1:1", label: "1:1" },
];

export type PromptComposerProps = {
  label?: string;
  /** A real example the user could send. */
  placeholder?: string;
  defaultValue?: string;
  value?: string;
  onChange?: ChangeEventHandler<HTMLTextAreaElement>;
  rows?: number;
  id?: string;
  types?: string[];
  type?: string;
  defaultType?: string;
  onTypeChange?: (type: string) => void;
  formats?: SegmentedOption[];
  defaultFormat?: string;
  onFormatChange?: (format: string) => void;
  onGenerate?: () => void;
  loading?: boolean;
  /** Shown under the prompt, which is marked invalid. */
  error?: string;
  /** Turns the generate button off, e.g. when the monthly allowance is used up. */
  generateDisabled?: boolean;
  submitLabel?: string;
  className?: string;
};

export function PromptComposer({
  label = "Describe your video",
  placeholder = "A 30-second reel that…",
  defaultValue,
  value,
  onChange,
  rows = 3,
  id,
  types = defaultVideoTypes,
  type,
  defaultType,
  onTypeChange,
  formats = defaultFormats,
  defaultFormat,
  onFormatChange,
  onGenerate,
  loading = false,
  error,
  generateDisabled = false,
  submitLabel = "Generate video",
  className,
}: PromptComposerProps) {
  const [ownType, setOwnType] = useState(defaultType ?? types[0]);
  const selectedType = type ?? ownType;
  const pickType = (next: string) => {
    if (type === undefined) setOwnType(next);
    onTypeChange?.(next);
  };

  return (
    <form
      className={cn(
        "flex flex-col gap-4 rounded-xl border border-line bg-surface p-5 shadow-sm",
        className,
      )}
      onSubmit={(event) => {
        event.preventDefault();
        onGenerate?.();
      }}
    >
      <TextField
        label={label}
        multiline
        rows={rows}
        placeholder={placeholder}
        defaultValue={defaultValue}
        value={value}
        onChange={onChange}
        id={id}
        error={error}
        controlClassName="border-transparent bg-surface-sunken text-[16px] leading-[22px] hover:border-transparent focus:border-brand-text focus:bg-surface"
      />
      <div role="group" aria-label="Video type" className="flex flex-wrap gap-2">
        {types.map((t) => (
          <Chip key={t} selected={t === selectedType} onClick={() => pickType(t)}>
            {t}
          </Chip>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl
          label="Format"
          size="sm"
          options={formats}
          defaultValue={defaultFormat ?? formats[0]?.value}
          onChange={onFormatChange}
        />
        <Button type="submit" icon="sparkles" loading={loading} disabled={generateDisabled}>
          {loading ? "Generating…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
