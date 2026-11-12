import type { Metadata } from "next";
import { Placeholder } from "@/components/shell/page-header";

export const metadata: Metadata = { title: "Posts · Vidcosmos" };

// Scheduled and published posts arrive in F28.
export default function PostsPage() {
  return (
    <Placeholder title="Posts">
      Reels you post or schedule to Instagram will show here, with their status.
    </Placeholder>
  );
}
