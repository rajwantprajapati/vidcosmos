import { ProjectPlaceholder, projectMetadata } from "@/components/shell/project-placeholder";

export const generateMetadata = projectMetadata("Editor");

// The editor arrives in F21-F25.
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <ProjectPlaceholder
      params={params}
      title="Editor"
      description="The live preview, the scenes and the chat for changes will show here."
    />
  );
}
