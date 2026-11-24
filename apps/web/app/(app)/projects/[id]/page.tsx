// The editor (F21): the video plays in the browser exactly as it will export. A video that hasn't
// been generated yet goes back to its step; one generating opens the Generating screen.
import { videoTypeLabels } from "@vidcosmos/spec/collections";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { EditorScreen } from "@/components/editor/editor-screen";
import { projectAudio } from "@/lib/audio";
import { findProject, loadProject, projectDto } from "@/lib/create";
import { requireSession } from "@/lib/session";

/** The tab title: the video's; a missing video gets the 404's own title. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const { workspace } = await requireSession(`/projects/${id}`);
  const found = await findProject(workspace, id);
  return { title: found ? `${found.title} · Vidcosmos` : "Page not found · Vidcosmos" };
}

export default async function EditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { workspace } = await requireSession(`/projects/${id}`);
  const project = await loadProject(workspace, id);
  if (project.stage === "generating") redirect(`/projects/${id}/generating`);
  // Not generated yet: the editor needs a version to play (and has no Generate), so the video
  // goes to the step it's at, as the library sends it (F21 QA).
  if (!project.draft.spec || project.currentVersion === null) {
    const step = project.draft.spec ? "storyboard" : project.script ? "script" : "idea";
    redirect(`/projects/${id}/${step}`);
  }
  const audio = await projectAudio(project);
  return (
    <EditorScreen
      project={projectDto(project, workspace, audio)}
      videoType={videoTypeLabels[project.idea.videoType ?? "explainer"]}
    />
  );
}
