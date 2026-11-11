import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
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
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
