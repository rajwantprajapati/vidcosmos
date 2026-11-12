// Light (Lagoon Classic) and dark (Lagoon Night) themes, switched by `data-theme` on <html>.
// The user's explicit choice (stored in this browser) wins; otherwise the system setting is used.

export type Theme = "light" | "dark";
export type ThemePreference = Theme | "system";

export const themeStorageKey = "vc-theme";

/**
 * Runs in <head> before the page paints, so there is no flash of the wrong theme.
 * Kept small and dependency-free because it is inlined as a string.
 */
export const themeScript = `(function () {
  var root = document.documentElement;
  var media = window.matchMedia("(prefers-color-scheme: dark)");
  function stored() {
    try { var v = localStorage.getItem("${themeStorageKey}"); return v === "light" || v === "dark" ? v : null; }
    catch (e) { return null; }
  }
  function apply() { root.setAttribute("data-theme", stored() || (media.matches ? "dark" : "light")); }
  apply();
  media.addEventListener("change", apply);
  window.addEventListener("storage", function (e) { if (e.key === "${themeStorageKey}") apply(); });
})();`;

/** The theme to show now: the stored choice, else the system setting. */
export function resolvedTheme(): Theme {
  const preference = getThemePreference();
  if (preference !== "system") return preference;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Read the stored preference; "system" when nothing is stored. */
export function getThemePreference(): ThemePreference {
  try {
    const value = localStorage.getItem(themeStorageKey);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system";
  }
}

/** Store the preference and apply it to the page now. */
export function setThemePreference(preference: ThemePreference): void {
  try {
    if (preference === "system") localStorage.removeItem(themeStorageKey);
    else localStorage.setItem(themeStorageKey, preference);
  } catch {
    // Storage can be blocked (private mode); the choice then lasts for this page only.
  }
  document.documentElement.setAttribute("data-theme", resolvedTheme());
  window.dispatchEvent(new Event(themeChangeEvent));
}

const themeChangeEvent = "vc-theme-change";

/** Subscribe to preference changes in this tab and others (for useSyncExternalStore). */
export function subscribeThemePreference(onChange: () => void): () => void {
  window.addEventListener(themeChangeEvent, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(themeChangeEvent, onChange);
    window.removeEventListener("storage", onChange);
  };
}
