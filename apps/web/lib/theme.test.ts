import { describe, expect, it } from "vitest";
import { themeScript, themeStorageKey } from "./theme";

/** Runs the inline <head> script against a fake browser and returns the theme it set. */
function runThemeScript({ stored, systemDark }: { stored: string | null; systemDark: boolean }) {
  const attributes: Record<string, string> = {};
  const document = {
    documentElement: { setAttribute: (name: string, value: string) => (attributes[name] = value) },
  };
  const window = {
    matchMedia: () => ({ matches: systemDark, addEventListener: () => {} }),
    addEventListener: () => {},
  };
  const localStorage = {
    getItem: (key: string) => (key === themeStorageKey ? stored : null),
  };
  new Function("document", "window", "localStorage", themeScript)(document, window, localStorage);
  return attributes["data-theme"];
}

describe("themeScript", () => {
  it("follows the system when nothing is stored", () => {
    expect(runThemeScript({ stored: null, systemDark: false })).toBe("light");
    expect(runThemeScript({ stored: null, systemDark: true })).toBe("dark");
  });

  it("lets the stored choice win over the system", () => {
    expect(runThemeScript({ stored: "light", systemDark: true })).toBe("light");
    expect(runThemeScript({ stored: "dark", systemDark: false })).toBe("dark");
  });

  it("ignores an unknown stored value", () => {
    expect(runThemeScript({ stored: "sepia", systemDark: true })).toBe("dark");
  });

  it("falls back to the system when storage is blocked", () => {
    const attributes: Record<string, string> = {};
    const document = {
      documentElement: { setAttribute: (n: string, v: string) => (attributes[n] = v) },
    };
    const window = {
      matchMedia: () => ({ matches: true, addEventListener: () => {} }),
      addEventListener: () => {},
    };
    const localStorage = {
      getItem: () => {
        throw new Error("SecurityError");
      },
    };
    new Function("document", "window", "localStorage", themeScript)(document, window, localStorage);
    expect(attributes["data-theme"]).toBe("dark");
  });
});
