import { ProjectPlaceholder, projectMetadata } from "@/components/shell/project-placeholder";

export const generateMetadata = projectMetadata("Script");

// Step 2 arrives in F15.
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <ProjectPlaceholder
      params={params}
      title="Script"
      description="Step 2: read and edit the narration script."
    />
  );
}
