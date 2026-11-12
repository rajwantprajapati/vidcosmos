import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ThemeSync } from "@/components/theme-sync";
import { themeScript } from "@/lib/theme";

export const metadata: Metadata = {
  title: "Vidcosmos",
  description: "A universe of videos, made by AI.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // The theme script sets data-theme before React hydrates, so the attribute differs from the server render.
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Inline and synchronous, so the theme is set before the first paint (no flash). It has
            to stay a plain <script> in <head>: next/script only queues it until Next's own
            scripts load, which is after the page has painted. */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <ThemeSync />
        {children}
      </body>
    </html>
  );
}
