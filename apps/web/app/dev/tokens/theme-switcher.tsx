"use client";

import { useSyncExternalStore } from "react";
import {
  getThemePreference,
  setThemePreference,
  subscribeThemePreference,
  type ThemePreference,
} from "@/lib/theme";

const options: { value: ThemePreference; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

/** Page theme for checking. The panels below always show both themes. */
export function ThemeSwitcher() {
  const preference = useSyncExternalStore(
    subscribeThemePreference,
    getThemePreference,
    () => "system" as const,
  );

  return (
    <fieldset className="flex flex-wrap items-center gap-2">
      <legend className="label mb-2 text-ink-secondary">Page theme</legend>
      {options.map((option) => (
        <label
          key={option.value}
          className="label flex min-h-10 cursor-pointer items-center gap-2 rounded-md border border-line-strong bg-surface px-3 has-checked:border-brand-soft-line has-checked:bg-brand-soft"
        >
          <input
            type="radio"
            name="theme"
            value={option.value}
            checked={preference === option.value}
            onChange={() => setThemePreference(option.value)}
            className="accent-brand"
          />
          {option.label}
        </label>
      ))}
    </fieldset>
  );
}
