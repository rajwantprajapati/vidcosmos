import { ProjectPlaceholder, projectMetadata } from "@/components/shell/project-placeholder";

export const generateMetadata = projectMetadata("Idea");

// Step 1 arrives in F14.
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <ProjectPlaceholder
      params={params}
      title="Idea"
      description="Step 1: describe the video and pick one of the suggested angles."
    />
  );
}
