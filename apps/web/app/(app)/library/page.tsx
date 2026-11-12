import type { Metadata } from "next";
import { Placeholder } from "@/components/shell/page-header";

export const metadata: Metadata = { title: "Library · Vidcosmos" };

// The library itself (prompt box, video grid, filters) arrives in F09.
export default function LibraryPage() {
  return (
    <Placeholder title="Your library">
      Your videos will show here, newest first. Start one with New video.
    </Placeholder>
  );
}
