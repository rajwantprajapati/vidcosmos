"use client";

// Puts `data-theme` back on <html> after React renders the root layout again in the browser
// (a 404 inside the app does that, and React doesn't run the inline script a second time). The
// inline script in <head> sets the attribute before the first paint on every page load; this
// only repairs it when React has replaced it.
import { useLayoutEffect } from "react";
import { resolvedTheme } from "@/lib/theme";

export function ThemeSync() {
  useLayoutEffect(() => {
    const root = document.documentElement;
    if (!root.getAttribute("data-theme")) root.setAttribute("data-theme", resolvedTheme());
  });
  return null;
}
