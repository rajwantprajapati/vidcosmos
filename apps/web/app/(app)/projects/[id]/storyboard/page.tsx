import { ProjectPlaceholder, projectMetadata } from "@/components/shell/project-placeholder";

export const generateMetadata = projectMetadata("Storyboard");

// Step 3 arrives in F17.
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <ProjectPlaceholder
      params={params}
      title="Storyboard"
      description="Step 3: check each scene before the video is made."
    />
  );
}
