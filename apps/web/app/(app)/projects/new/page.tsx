import type { Metadata } from "next";
import { Placeholder } from "@/components/shell/page-header";

export const metadata: Metadata = { title: "New video · Vidcosmos" };

// F14 turns this into "create the project, then open step 1 (/projects/[id]/idea)".
export default function NewVideoPage() {
  return (
    <Placeholder title="New video">
      Describe a video, pick its type and format, and Vidcosmos writes the script.
    </Placeholder>
  );
}
