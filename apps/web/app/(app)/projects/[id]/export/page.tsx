import { ProjectPlaceholder, projectMetadata } from "@/components/shell/project-placeholder";

export const generateMetadata = projectMetadata("Export and post");

// Export and posting arrive in F26-F28.
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <ProjectPlaceholder
      params={params}
      title="Export and post"
      description="Download the MP4, or post it to Instagram now or later."
    />
  );
}
