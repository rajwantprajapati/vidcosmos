"use client";

// Two to five options that apply immediately. A radio group: Tab reaches it once,
// the arrow keys move the choice (Radix RadioGroup).
import * as RadioGroup from "@radix-ui/react-radio-group";
import type { ReactNode } from "react";
import { cn } from "./cn";

export type SegmentedOption = {
  value: string;
  label: ReactNode;
  /** "hi" for a Devanagari label. */
  lang?: string;
};

export type SegmentedControlProps = {
  options: SegmentedOption[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  /** Accessible name of the group, e.g. "Format". */
  label: string;
  size?: "sm" | "md";
  className?: string;
};

export function SegmentedControl({
  options,
  value,
  defaultValue,
  onChange,
  label,
  size = "md",
  className,
}: SegmentedControlProps) {
  return (
    <RadioGroup.Root
      aria-label={label}
      orientation="horizontal"
      value={value}
      defaultValue={value === undefined ? (defaultValue ?? options[0]?.value) : undefined}
      onValueChange={onChange}
      className={cn("inline-flex gap-1 rounded-[12px] bg-surface-sunken p-1", className)}
    >
      {options.map((option) => (
        <RadioGroup.Item
          key={option.value}
          value={option.value}
          lang={option.lang}
          className={cn(
            "cursor-pointer rounded-sm border-0 bg-transparent font-semibold text-ink-muted hover:text-ink",
            "data-[state=checked]:bg-surface data-[state=checked]:text-ink data-[state=checked]:shadow-sm",
            "[&:lang(hi)]:font-deva [&:lang(hi)]:font-medium",
            size === "sm"
              ? "min-h-7 px-2.5 py-1 text-[13px] leading-5"
              : "min-h-8 px-3.5 py-1.5 text-[14px] leading-5",
          )}
        >
          {option.label}
        </RadioGroup.Item>
      ))}
    </RadioGroup.Root>
  );
}
