import { ProjectPlaceholder, projectMetadata } from "@/components/shell/project-placeholder";

export const generateMetadata = projectMetadata("Generating");

// Step 4 arrives in F20.
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <ProjectPlaceholder
      params={params}
      title="Generating"
      description="Step 4: the narration is recorded and every scene is animated."
    />
  );
}
