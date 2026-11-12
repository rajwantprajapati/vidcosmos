import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Placeholder } from "./page-header";

const isProjectId = (id: string) => /^[0-9a-f]{24}$/.test(id);

/** The tab title of a project page; a 404's own title when the id can't be a project. */
export function projectMetadata(title: string) {
  return async ({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> => ({
    title: isProjectId((await params).id) ? `${title} · Vidcosmos` : "Page not found · Vidcosmos",
  });
}

/** A project page that a later feature builds. Ids that aren't ObjectIds are a 404 already. */
export async function ProjectPlaceholder({
  params,
  title,
  description,
}: {
  params: Promise<{ id: string }>;
  title: string;
  description: string;
}) {
  const { id } = await params;
  if (!isProjectId(id)) notFound();
  return <Placeholder title={title}>{description}</Placeholder>;
}
