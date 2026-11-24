// Step 4 of a video: generating it (F20, Generating design). Shows the generation running on
// the project, or the latest one: a finished generation opens the editor, and with none the
// page goes back to where the video is (the editor once it has a version, the storyboard
// before).
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { GeneratingStep } from "@/components/create/generating-step";
import { findProject, latestJob, loadProject, projectDto } from "@/lib/create";
import { requireSession } from "@/lib/session";

/** The tab title; a missing video gets the 404's own title. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const { workspace } = await requireSession(`/projects/${id}/generating`);
  const found = await findProject(workspace, id);
  return { title: found ? "Generating · Vidcosmos" : "Page not found · Vidcosmos" };
}

export default async function GeneratingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { workspace } = await requireSession(`/projects/${id}/generating`);
  const project = await loadProject(workspace, id);
  const job = await latestJob(workspace._id, project, ["generate", "scene_retry"]);
  if (!job || job.status === "succeeded") {
    redirect(project.currentVersion === null ? `/projects/${id}/storyboard` : `/projects/${id}`);
  }
  const { voiceGender, language } = project.settings;
  return (
    <GeneratingStep
      project={projectDto(project, workspace)}
      job={job}
      // Not "Indian" while the narrators are ElevenLabs' default voices (decision log, 24 Nov).
      voiceLabel={`${voiceGender === "female" ? "Female" : "Male"} voice · ${language === "hi" ? "Hindi" : "English"}`}
    />
  );
}
